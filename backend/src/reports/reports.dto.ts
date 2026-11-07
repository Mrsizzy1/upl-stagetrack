import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../common/http/pagination.dto';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class DashboardQueryDto {
  @IsOptional()
  @Matches(ISO_DATE)
  date?: string;

  @IsOptional()
  @IsUUID()
  facultyId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  promotionId?: string;
}

export const REPORT_PERIODS = ['daily', 'weekly', 'monthly', 'custom'] as const;
export const REPORT_GROUPS = ['student', 'faculty', 'promotion', 'session', 'day'] as const;

export class ReportQueryDto {
  @IsIn(REPORT_PERIODS)
  period!: (typeof REPORT_PERIODS)[number];

  /** Date de référence (ou début si période personnalisée). */
  @Matches(ISO_DATE, { message: 'Date au format AAAA-MM-JJ' })
  date!: string;

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
  @Matches(ISO_DATE, { message: 'Date au format AAAA-MM-JJ' })
  to?: string;

  @IsIn(REPORT_GROUPS)
  groupBy!: (typeof REPORT_GROUPS)[number];

  @IsOptional()
  @IsIn(['MORNING', 'EVENING'])
  sessionType?: 'MORNING' | 'EVENING';

  @IsOptional()
  @IsUUID()
  studentId?: string;
}

export class AuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  entityId?: string;

  @IsOptional()
  @Matches(ISO_DATE)
  from?: string;

  @IsOptional()
  @Matches(ISO_DATE)
  to?: string;
}

export class ScanAttemptQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  result?: string;

  @IsOptional()
  @Matches(ISO_DATE)
  date?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;
}
