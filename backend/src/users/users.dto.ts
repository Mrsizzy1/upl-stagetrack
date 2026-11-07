import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../common/http/pagination.dto';

/** Rôles attribuables depuis la gestion des comptes. Les comptes étudiants se créent depuis la fiche étudiant. */
export const STAFF_ROLES = ['ADMIN', 'SUPERVISOR', 'SCAN_AGENT'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateUserDto {
  @Transform(trim)
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,50}$/, { message: "L'identifiant contient 3 à 50 lettres, chiffres, points, tirets" })
  username!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email?: string;

  @IsIn(STAFF_ROLES)
  role!: StaffRole;

  /** Mot de passe provisoire, à changer à la première connexion. */
  @IsString()
  @MaxLength(128)
  temporaryPassword!: string;
}

export class UpdateUserDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email?: string | null;

  @IsOptional()
  @IsIn(STAFF_ROLES)
  role?: StaffRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetPasswordDto {
  @IsString()
  @MaxLength(128)
  temporaryPassword!: string;
}

export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['ADMIN', 'SUPERVISOR', 'SCAN_AGENT', 'STUDENT'])
  role?: 'ADMIN' | 'SUPERVISOR' | 'SCAN_AGENT' | 'STUDENT';
}
