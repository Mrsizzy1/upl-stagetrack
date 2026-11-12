import { BadRequestException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Role, User } from '../generated/prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth/auth.decorators';
import type { AccessTokenPayload } from '../common/auth/auth.guard';
import { Clock } from '../common/clock/clock';
import type { RequestMeta } from '../common/http/request-meta';
import { ARGON2_OPTIONS } from '../common/security/password-hashing';
import { checkPasswordPolicy, normalizeUsername } from '../common/security/password-policy';
import { PrismaService } from '../prisma/prisma.service';
import { KeyedMutex, LoginThrottle } from './login-throttle';

/**
 * Deux protections complémentaires contre la recherche de mot de passe :
 *  - par source (identifiant + adresse IP) : 5 tentatives par 15 minutes, puis 15 minutes de blocage.
 *    Un tiers qui se trompe volontairement ne bloque que lui-même ;
 *  - par compte, quelle que soit l'adresse : 20 échecs consécutifs bloquent le compte 15 minutes
 *    (attaque répartie sur de nombreuses adresses).
 * Les compteurs sont incrémentés avant la vérification : des essais parallèles ne passent pas au travers.
 */
export const MAX_ATTEMPTS_PER_SOURCE = 5;
export const MAX_FAILED_LOGINS = 20;
export const LOCK_MINUTES = 15;

/** Un jeton remplacé il y a moins de 30 s et rejoué (deux onglets, deux requêtes simultanées) n'est pas un vol. */
export const REFRESH_REUSE_GRACE_MS = 30_000;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: PublicUser;
}

export interface PublicUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: Role['code'];
  studentId: string | null;
  mustChangePassword: boolean;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService implements OnModuleInit {
  /** Hachage factice : un identifiant inconnu coûte le même temps qu'un mauvais mot de passe. */
  private dummyHash = '';
  private readonly throttle = new LoginThrottle(MAX_ATTEMPTS_PER_SOURCE, LOCK_MINUTES * 60_000, LOCK_MINUTES * 60_000);
  /** Jetons de rafraîchissement remplacés par rotation (empreinte → instant), pour la tolérance multi-onglets. */
  private readonly rotated = new Map<string, { at: number; successorHash: string }>();
  private readonly refreshLock = new KeyedMutex();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash(randomBytes(16).toString('hex'), ARGON2_OPTIONS);
  }

  async login(usernameInput: string, password: string, meta: RequestMeta): Promise<SessionTokens> {
    const username = normalizeUsername(usernameInput);
    const now = this.clock.now();
    const source = LoginThrottle.key(username, meta.ip);

    // 1. Limite par source, réservée avant tout calcul (identifiant connu ou non : même réponse).
    const decision = this.throttle.attempt(source, now);
    if (!decision.allowed) {
      await this.audit.log({ actorId: null, action: 'LOGIN_THROTTLED', entityType: 'User', after: { username }, ip: meta.ip });
      throw this.tooManyAttempts(decision.retryAt!, now);
    }

    const user = await this.prisma.user.findUnique({ where: { username }, include: { role: true, student: true } });
    if (!user) {
      await argon2.verify(this.dummyHash, password).catch(() => false);
      await this.audit.log({ actorId: null, action: 'LOGIN_FAILED', entityType: 'User', after: { username }, ip: meta.ip });
      throw this.invalidCredentials();
    }

    if (user.lockedUntil && user.lockedUntil > now) throw this.tooManyAttempts(user.lockedUntil, now);

    // 2. Compteur du compte, incrémenté de façon atomique avant la vérification.
    const { failedLoginCount } = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    if (failedLoginCount > MAX_FAILED_LOGINS) {
      const lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60_000);
      const locked = await this.prisma.user.updateMany({
        where: { id: user.id, failedLoginCount: { gt: MAX_FAILED_LOGINS } },
        data: { failedLoginCount: 0, lockedUntil },
      });
      if (locked.count > 0) {
        await this.audit.log({ actorId: null, action: 'ACCOUNT_LOCKED', entityType: 'User', entityId: user.id, ip: meta.ip });
      }
      throw this.tooManyAttempts(lockedUntil, now);
    }

    const valid = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!valid) {
      await this.audit.log({ actorId: null, action: 'LOGIN_FAILED', entityType: 'User', entityId: user.id, ip: meta.ip });
      throw this.invalidCredentials();
    }

    if (!user.isActive) {
      throw new UnauthorizedException({ code: 'ACCOUNT_DISABLED', message: 'Ce compte est désactivé.' });
    }

    this.throttle.reset(source);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
    });
    await this.audit.log({ actorId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id, ip: meta.ip });
    return this.issueSession(user, meta);
  }

  /** Rotation : l'ancien jeton est révoqué, un nouveau est émis. Un jeton déjà révoqué rejoué = vol présumé. */
  async refresh(rawToken: string | undefined, meta: RequestMeta): Promise<SessionTokens> {
    if (!rawToken) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Session absente' });
    const tokenHash = sha256(rawToken);
    // Les rotations d'un même jeton passent l'une après l'autre : la seconde voit le résultat de la première.
    return this.refreshLock.run(tokenHash, () => this.rotate(tokenHash, meta));
  }

  private async rotate(tokenHash: string, meta: RequestMeta): Promise<SessionTokens> {
    const now = this.clock.now();
    this.pruneRotated(now.getTime());
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { role: true, student: true } } },
    });
    if (!stored) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Session inconnue' });
    if (stored.expiresAt <= now || !stored.user.isActive) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Session expirée' });
    }

    // Révocation conditionnelle : une seule requête peut remplacer un jeton encore valide.
    const { count } = stored.revokedAt
      ? { count: 0 }
      : await this.prisma.refreshToken.updateMany({ where: { id: stored.id, revokedAt: null }, data: { revokedAt: now } });
    if (count === 1) {
      const session = await this.issueSession(stored.user, meta);
      this.rotated.set(tokenHash, { at: now.getTime(), successorHash: sha256(session.refreshToken) });
      return session;
    }

    // Jeton déjà remplacé. Rejeu immédiat par un autre onglet du même navigateur : nouvelle session,
    // à condition que la session qui l'a remplacé soit toujours ouverte (pas de déconnexion ni de
    // changement de mot de passe entre-temps). Sinon : vol présumé, toutes les sessions sont fermées.
    const rotation = this.rotated.get(tokenHash);
    if (rotation && now.getTime() - rotation.at <= REFRESH_REUSE_GRACE_MS) {
      const successor = await this.prisma.refreshToken.findUnique({ where: { tokenHash: rotation.successorHash } });
      if (successor && !successor.revokedAt) return this.issueSession(stored.user, meta);
    }

    await this.prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    await this.audit.log({
      actorId: stored.userId,
      action: 'REFRESH_TOKEN_REUSE',
      entityType: 'User',
      entityId: stored.userId,
      ip: meta.ip,
    });
    throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Session invalidée, reconnectez-vous' });
  }

  private pruneRotated(t: number): void {
    if (this.rotated.size < 1000) return;
    for (const [hash, r] of this.rotated) if (t - r.at > REFRESH_REUSE_GRACE_MS) this.rotated.delete(hash);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: this.clock.now() },
    });
  }

  async changePassword(actor: AuthUser, currentPassword: string, newPassword: string, meta: RequestMeta): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    const valid = await argon2.verify(user.passwordHash, currentPassword).catch(() => false);
    if (!valid) throw new BadRequestException({ code: 'INVALID_PASSWORD', message: 'Mot de passe actuel incorrect' });
    if (currentPassword === newPassword) {
      throw new BadRequestException({ code: 'PASSWORD_UNCHANGED', message: "Le nouveau mot de passe doit être différent de l'ancien" });
    }
    const errors = checkPasswordPolicy(newPassword, user.username);
    if (errors.length > 0) throw new BadRequestException({ code: 'WEAK_PASSWORD', message: errors.join('. '), details: errors });

    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: await argon2.hash(newPassword, ARGON2_OPTIONS), mustChangePassword: false },
      });
      // Les autres sessions ouvertes sont fermées.
      await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
      await this.audit.log({ actorId: user.id, action: 'PASSWORD_CHANGED', entityType: 'User', entityId: user.id, ip: meta.ip }, tx);
    });
  }

  async profile(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { role: true, student: true } });
    return this.toPublic(user);
  }

  async issueSession(user: User & { role: Role; student: { id: string } | null }, meta: RequestMeta): Promise<SessionTokens> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role.code };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS'),
      algorithm: 'HS256',
    });
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(
      this.clock.now().getTime() + this.config.getOrThrow<number>('JWT_REFRESH_TTL_DAYS') * 86_400_000,
    );
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: refreshExpiresAt,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    return { accessToken, refreshToken, refreshExpiresAt, user: this.toPublic(user) };
  }

  private toPublic(user: User & { role: Role; student: { id: string } | null }): PublicUser {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role.code,
      studentId: user.student?.id ?? null,
      mustChangePassword: user.mustChangePassword,
    };
  }

  private tooManyAttempts(until: Date, now: Date) {
    const minutes = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
    return new UnauthorizedException({
      code: 'ACCOUNT_LOCKED',
      message: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`,
    });
  }

  private invalidCredentials() {
    return new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Identifiant ou mot de passe incorrect' });
  }
}
