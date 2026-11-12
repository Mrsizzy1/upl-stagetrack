import { ItemCategory, ItemStatus, ItemType, ClaimStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class DeclareItemDto {
  @IsEnum(ItemType)
  type!: ItemType;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title!: string;

  @IsEnum(ItemCategory)
  category!: ItemCategory;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  description!: string;

  @IsDateString()
  eventDate!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  location!: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  photoPath?: string;
}

export class ListPublicItemsQueryDto {
  @IsOptional()
  @IsEnum(ItemType)
  type?: ItemType;

  @IsOptional()
  @IsEnum(ItemCategory)
  category?: ItemCategory;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}

export class ClaimItemDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  claimantName!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  claimantPhone!: string;

  @IsOptional()
  @IsEmail()
  claimantEmail?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  proofDescription!: string;

  @IsOptional()
  @IsString()
  proofPhotoPath?: string;
}

export class UpdateItemStatusDto {
  @IsEnum(ItemStatus)
  status!: ItemStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class ReviewClaimDto {
  @IsEnum(ClaimStatus)
  status!: ClaimStatus;

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

export class ConfirmReturnDto {
  @IsOptional()
  @IsString()
  claimId?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  returnedToName!: string;

  @IsOptional()
  @IsString()
  returnedToIdNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

