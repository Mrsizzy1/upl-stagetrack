import { ComponentState, InterventionPriority, InterventionStatus, MachineStatus } from '../generated/prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateMachineDto {
  @IsUUID()
  laboratoryId!: string;

  @IsUUID()
  rowId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  code!: string; // ex: LAB01-RG-M01

  @IsString()
  @IsNotEmpty()
  name!: string; // ex: Poste M01

  @Type(() => Number)
  @IsInt()
  @Min(1)
  positionInRow!: number;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;

  @IsOptional()
  @IsString()
  specifications?: string;

  @IsOptional()
  @IsString()
  photoPath?: string;
}

export class UpdateMachineDto {
  @IsOptional()
  @IsUUID()
  rowId?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  positionInRow?: number;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;

  @IsOptional()
  @IsString()
  specifications?: string;

  @IsOptional()
  @IsString()
  photoPath?: string;

  @IsOptional()
  @IsEnum(MachineStatus)
  generalStatus?: MachineStatus;
}

export class ComponentControlItemDto {
  @IsUUID()
  componentTypeId!: string;

  @IsEnum(ComponentState)
  state!: ComponentState;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PerformControlDto {
  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsString()
  photoPath?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponentControlItemDto)
  components!: ComponentControlItemDto[];
}

export class CreateInterventionDto {
  @IsUUID()
  machineId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  description!: string;

  @IsEnum(InterventionPriority)
  priority!: InterventionPriority;

  @IsOptional()
  @IsUUID()
  technicianId?: string;
}

export class UpdateInterventionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(InterventionPriority)
  priority?: InterventionPriority;

  @IsOptional()
  @IsEnum(InterventionStatus)
  status?: InterventionStatus;

  @IsOptional()
  @IsUUID()
  technicianId?: string;

  @IsOptional()
  @IsString()
  resolutionReport?: string;

  @IsOptional()
  @IsString()
  replacedParts?: string;
}

export class ReportIssueDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  description!: string;

  @IsOptional()
  @IsString()
  contact?: string;
}

