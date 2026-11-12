/**
 * Garde globale : authentification JWT puis autorisation par rôle, refus par défaut.
 * Le compte est relu en base à chaque requête : une désactivation ou un changement de rôle
 * prend effet immédiatement, sans attendre l'expiration du jeton.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { RoleCode } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ALLOW_PENDING_PASSWORD_KEY,
  AuthenticatedRequest,
  IS_PUBLIC_KEY,
  ROLES_KEY,
} from './auth.decorators';

export interface AccessTokenPayload {
  sub: string;
  role: RoleCode;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Connexion requise' });
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(header.slice(7), {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'Session expirée, reconnectez-vous' });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true, student: { select: { id: true } } },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({ code: 'ACCOUNT_DISABLED', message: 'Compte désactivé ou inexistant' });
    }

    request.user = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role.code,
      studentId: user.student?.id ?? null,
      mustChangePassword: user.mustChangePassword,
    };

    if (user.mustChangePassword && !this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_KEY, targets)) {
      throw new ForbiddenException({ code: 'PASSWORD_CHANGE_REQUIRED', message: 'Vous devez changer votre mot de passe' });
    }

    const roles = this.reflector.getAllAndOverride<RoleCode[] | undefined>(ROLES_KEY, targets);
    if (!roles || roles.length === 0 || !this.isRoleAllowed(user.role.code, roles)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: "Accès refusé pour votre rôle" });
    }
    return true;
  }

  private isRoleAllowed(userRole: RoleCode, allowedRoles: RoleCode[]): boolean {
    if (allowedRoles.includes(userRole)) return true;
    if (userRole === 'SUPER_ADMIN') return true;
    if (allowedRoles.includes('ADMIN') && userRole === 'FACULTY_ADMIN') return true;
    if (allowedRoles.includes('STUDENT') && userRole === 'INTERN') return true;
    if (allowedRoles.includes('INTERN') && userRole === 'STUDENT') return true;
    if (allowedRoles.includes('SUPERVISOR') && (userRole === 'INTERNSHIP_MANAGER' || userRole === 'FACULTY_ADMIN')) return true;
    return false;
  }
}
