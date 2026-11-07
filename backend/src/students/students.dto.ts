import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../common/http/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : typeof value === 'string' ? value.trim() : value);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'Date au format AAAA-MM-JJ';

export const STUDENT_STATUSES = ['ACTIVE', 'SUSPENDED', 'COMPLETED'] as const;

export class InternshipDto {
  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  startDate!: string;

  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  endDate!: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(150)
  hostService?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  supervisorId?: string | null;
}

export class CreateStudentDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  matricule!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  middleName!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsUUID()
  facultyId!: string;

  @IsUUID()
  departmentId!: string;

  @IsUUID()
  promotionId!: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Matches(/^\+?[0-9 ]{6,20}$/, { message: 'Numéro de téléphone invalide' })
  phone?: string | null;

  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  enrolledAt!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => InternshipDto)
  internship?: InternshipDto;
}

export class UpdateStudentDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  middleName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsUUID()
  facultyId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  promotionId?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Matches(/^\+?[0-9 ]{6,20}$/, { message: 'Numéro de téléphone invalide' })
  phone?: string | null;

  @IsOptional()
  @Matches(ISO_DATE, { message: DATE_MESSAGE })
  enrolledAt?: string;
}

export class ChangeStatusDto {
  @IsIn(STUDENT_STATUSES)
  status!: (typeof STUDENT_STATUSES)[number];

  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Motif de 5 caractères minimum' })
  @MaxLength(500)
  reason!: string;
}

export class ReasonDto {
  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Motif de 5 caractères minimum' })
  @MaxLength(500)
  reason!: string;
}

export class StudentAccountDto {
  @IsString()
  @MaxLength(128)
  temporaryPassword!: string;
}

export class ListStudentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  facultyId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  promotionId?: string;

  @IsOptional()
  @IsIn(STUDENT_STATUSES)
  status?: (typeof STUDENT_STATUSES)[number];
}
