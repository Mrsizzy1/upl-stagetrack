import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { RoleCode } from '@prisma/client';
import type { Request } from 'express';

export const IS_PUBLIC_KEY = 'auth:public';
export const ROLES_KEY = 'auth:roles';
export const ALLOW_PENDING_PASSWORD_KEY = 'auth:allowPendingPassword';

/** Route accessible sans connexion. À utiliser avec parcimonie. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Rôles autorisés. Une route sans @Roles ni @Public est refusée à tout le monde :
 * oublier de déclarer les rôles ne peut jamais ouvrir une route par accident.
 */
export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);

/** Route utilisable même si l'utilisateur doit encore changer son mot de passe. */
export const AllowPendingPassword = () => SetMetadata(ALLOW_PENDING_PASSWORD_KEY, true);

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: RoleCode;
  studentId: string | null;
  mustChangePassword: boolean;
}

export type AuthenticatedRequest = Request & { user: AuthUser };

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
});

/** Les quatre rôles, pour les routes de consultation communes. */
export const ALL_ROLES: RoleCode[] = ['ADMIN', 'SUPERVISOR', 'SCAN_AGENT', 'STUDENT'];
