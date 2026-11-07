import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../common/http/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ScanDto {
  /** Texte lu par la caméra dans le QR Code. */
  @IsString()
  @MaxLength(200)
  qr!: string;
}

export class ManualScanDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  matricule!: string;

  /** Motif obligatoire : QR oublié, illisible, téléphone déchargé… */
  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Motif de 5 caractères minimum' })
  @MaxLength(300)
  reason!: string;
}

export class SessionScheduleDto {
  @Matches(HHMM, { message: 'Heure au format HH:MM' })
  opensAt!: string;

  @Matches(HHMM, { message: 'Heure au format HH:MM' })
  closesAt!: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @Matches(HHMM, { message: 'Heure au format HH:MM' })
  lateAfter?: string | null;

  @IsArray()
  @ArrayMaxSize(7)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays!: number[];
}

export class UpdateSchedulesDto {
  @Matches(ISO_DATE, { message: 'Date au format AAAA-MM-JJ' })
  effectiveFrom!: string;

  @ValidateNested()
  @Type(() => SessionScheduleDto)
  morning!: SessionScheduleDto;

  @ValidateNested()
  @Type(() => SessionScheduleDto)
  evening!: SessionScheduleDto;
}

export class NonWorkingDayDto {
  @Matches(ISO_DATE, { message: 'Date au format AAAA-MM-JJ' })
  date!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;
}

export const ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'ABSENT'] as const;
export const SESSION_TYPES = ['MORNING', 'EVENING'] as const;

export class ListAttendanceQueryDto extends PaginationQueryDto {
  @Matches(ISO_DATE, { message: 'Date au format AAAA-MM-JJ' })
  date!: string;

  @IsOptional()
  @IsIn(SESSION_TYPES)
  sessionType?: (typeof SESSION_TYPES)[number];

  @IsOptional()
  @IsIn(ATTENDANCE_STATUSES)
  status?: (typeof ATTENDANCE_STATUSES)[number];

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
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class HistoryQueryDto {
  @IsOptional()
  @Matches(ISO_DATE)
  from?: string;

  @IsOptional()
  @Matches(ISO_DATE)
  to?: string;
}

export class CorrectionDto {
  @IsIn(ATTENDANCE_STATUSES)
  newStatus!: (typeof ATTENDANCE_STATUSES)[number];

  @Transform(trim)
  @IsString()
  @MinLength(10, { message: 'Motif de 10 caractères minimum' })
  @MaxLength(500)
  reason!: string;
}
