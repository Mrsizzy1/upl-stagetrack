import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleCode } from '../generated/prisma/client';
import * as argon2 from 'argon2';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth/auth.decorators';
import { Clock } from '../common/clock/clock';
import { paginate, Paginated } from '../common/http/pagination.dto';
import { ARGON2_OPTIONS } from '../common/security/password-hashing';
import { checkPasswordPolicy, normalizeUsername } from '../common/security/password-policy';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from './users.dto';

const userSelect = {
  id: true,
  username: true,
  fullName: true,
  email: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  lockedUntil: true,
  createdAt: true,
  role: { select: { code: true, label: true } },
  student: { select: { id: true, matricule: true } },
} satisfies Prisma.UserSelect;

export type UserView = Prisma.UserGetPayload<{ select: typeof userSelect }>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async list(query: ListUsersQueryDto): Promise<Paginated<UserView>> {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: { code: query.role } } : {}),
      ...(query.search
        ? {
            OR: [
              { username: { contains: query.search, mode: 'insensitive' } },
              { fullName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, select: userSelect, orderBy: { fullName: 'asc' }, ...paginate(query) }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async create(dto: CreateUserDto, actor: AuthUser, ip: string | null): Promise<UserView> {
    const username = normalizeUsername(dto.username);
    this.assertPassword(dto.temporaryPassword, username);
    const role = await this.prisma.role.findUniqueOrThrow({ where: { code: dto.role } });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username,
            fullName: dto.fullName,
            email: dto.email || null,
            roleId: role.id,
            passwordHash: await argon2.hash(dto.temporaryPassword, ARGON2_OPTIONS),
            mustChangePassword: true,
          },
          select: userSelect,
        });
        await this.audit.log(
          { actorId: actor.id, action: 'USER_CREATED', entityType: 'User', entityId: user.id, after: { username, role: dto.role }, ip },
          tx,
        );
        return user;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: 'USERNAME_TAKEN', message: 'Cet identifiant ou cet e-mail est déjà utilisé' });
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser, ip: string | null): Promise<UserView> {
    const before = await this.prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!before) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Compte introuvable' });
    if (before.role.code === 'STUDENT' && dto.role) {
      throw new BadRequestException({ code: 'STUDENT_ROLE_FIXED', message: "Le rôle d'un compte étudiant ne peut pas être changé" });
    }
    if (id === actor.id && (dto.isActive === false || (dto.role && dto.role !== 'ADMIN'))) {
      throw new BadRequestException({
        code: 'SELF_LOCKOUT',
        message: 'Vous ne pouvez ni désactiver votre propre compte ni retirer votre rôle administrateur',
      });
    }
    if (before.role.code === 'ADMIN' && (dto.isActive === false || (dto.role && dto.role !== 'ADMIN'))) {
      await this.assertAnotherActiveAdmin(id);
    }

    const roleId = dto.role ? (await this.prisma.role.findUniqueOrThrow({ where: { code: dto.role as RoleCode } })).id : undefined;
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.user.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          email: dto.email === undefined ? undefined : dto.email,
          roleId,
          isActive: dto.isActive,
        },
        select: userSelect,
      });
      if (dto.isActive === false) {
        await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: this.clock.now() } });
      }
      await this.audit.log(
        {
          actorId: actor.id,
          action: 'USER_UPDATED',
          entityType: 'User',
          entityId: id,
          before: { fullName: before.fullName, email: before.email, role: before.role.code, isActive: before.isActive },
          after: { fullName: after.fullName, email: after.email, role: after.role.code, isActive: after.isActive },
          ip,
        },
        tx,
      );
      return after;
    });
  }

  async resetPassword(id: string, temporaryPassword: string, actor: AuthUser, ip: string | null): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Compte introuvable' });
    this.assertPassword(temporaryPassword, user.username);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          passwordHash: await argon2.hash(temporaryPassword, ARGON2_OPTIONS),
          mustChangePassword: true,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: this.clock.now() } });
      await this.audit.log({ actorId: actor.id, action: 'PASSWORD_RESET', entityType: 'User', entityId: id, ip }, tx);
    });
  }

  /** Crée le compte de connexion d'un étudiant (identifiant = matricule). */
  async createStudentAccount(studentId: string, temporaryPassword: string, actor: AuthUser, ip: string | null): Promise<UserView> {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Étudiant introuvable' });
    if (student.userId) throw new ConflictException({ code: 'ACCOUNT_EXISTS', message: 'Cet étudiant a déjà un compte' });
    const username = normalizeUsername(student.matricule);
    this.assertPassword(temporaryPassword, username);
    const role = await this.prisma.role.findUniqueOrThrow({ where: { code: 'STUDENT' } });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username,
            fullName: `${student.lastName} ${student.middleName} ${student.firstName}`,
            email: student.email,
            roleId: role.id,
            passwordHash: await argon2.hash(temporaryPassword, ARGON2_OPTIONS),
            mustChangePassword: true,
          },
          select: { id: true },
        });
        await tx.student.update({ where: { id: studentId }, data: { userId: user.id } });
        await this.audit.log(
          { actorId: actor.id, action: 'STUDENT_ACCOUNT_CREATED', entityType: 'Student', entityId: studentId, after: { username }, ip },
          tx,
        );
        return tx.user.findUniqueOrThrow({ where: { id: user.id }, select: userSelect });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: 'USERNAME_TAKEN', message: 'Un compte utilise déjà ce matricule ou cet e-mail' });
      }
      throw e;
    }
  }

  private assertPassword(password: string, username: string): void {
    const errors = checkPasswordPolicy(password, username);
    if (errors.length > 0) throw new BadRequestException({ code: 'WEAK_PASSWORD', message: errors.join('. '), details: errors });
  }

  private async assertAnotherActiveAdmin(excludedId: string): Promise<void> {
    const others = await this.prisma.user.count({
      where: { id: { not: excludedId }, isActive: true, role: { code: 'ADMIN' } },
    });
    if (others === 0) {
      throw new BadRequestException({ code: 'LAST_ADMIN', message: 'Il doit rester au moins un administrateur actif' });
    }
  }
}
