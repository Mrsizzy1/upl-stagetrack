/**
 * Référentiel académique : facultés, départements, promotions.
 * Aucune valeur n'est préremplie : la liste officielle vient de l'UPL (question Q1).
 */
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { Request } from 'express';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser, CurrentUser, Roles } from '../common/auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

const upperTrim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class CodeNameDto {
  @Transform(upperTrim)
  @IsString()
  @Matches(/^[A-Z0-9_-]{1,20}$/, { message: 'Code : 1 à 20 lettres, chiffres, tirets' })
  code!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;
}

class CreateDepartmentDto extends CodeNameDto {
  @IsUUID()
  facultyId!: string;
}

class UpdateCodeNameDto {
  @IsOptional()
  @Transform(upperTrim)
  @Matches(/^[A-Z0-9_-]{1,20}$/)
  code?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;
}

class PromotionDto {
  @Transform(upperTrim)
  @Matches(/^[A-Z0-9_-]{1,20}$/)
  code!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder!: number;
}

class UpdatePromotionDto {
  @IsOptional()
  @Transform(upperTrim)
  @Matches(/^[A-Z0-9_-]{1,20}$/)
  code?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

@ApiTags('Référentiel')
@ApiBearerAuth()
@Controller('reference')
export class ReferenceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Roles('ADMIN', 'SUPERVISOR')
  @Get()
  async all() {
    const [faculties, promotions] = await this.prisma.$transaction([
      this.prisma.faculty.findMany({
        orderBy: { name: 'asc' },
        include: { departments: { orderBy: { name: 'asc' } }, _count: { select: { students: true } } },
      }),
      this.prisma.promotion.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }], include: { _count: { select: { students: true } } } }),
    ]);
    return { faculties, promotions };
  }

  @Roles('ADMIN')
  @Post('faculties')
  async createFaculty(@Body() dto: CodeNameDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    const faculty = await this.prisma.faculty.create({ data: dto });
    await this.log(actor, req, 'FACULTY_CREATED', 'Faculty', faculty.id, null, faculty);
    return faculty;
  }

  @Roles('ADMIN')
  @Patch('faculties/:id')
  async updateFaculty(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCodeNameDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    const before = await this.prisma.faculty.findUniqueOrThrow({ where: { id } });
    const after = await this.prisma.faculty.update({ where: { id }, data: dto });
    await this.log(actor, req, 'FACULTY_UPDATED', 'Faculty', id, before, after);
    return after;
  }

  @Roles('ADMIN')
  @Delete('faculties/:id')
  @HttpCode(204)
  async deleteFaculty(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    const before = await this.prisma.faculty.delete({ where: { id } });
    await this.log(actor, req, 'FACULTY_DELETED', 'Faculty', id, before, null);
  }

  @Roles('ADMIN')
  @Post('departments')
  async createDepartment(@Body() dto: CreateDepartmentDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    const department = await this.prisma.department.create({ data: dto });
    await this.log(actor, req, 'DEPARTMENT_CREATED', 'Department', department.id, null, department);
    return department;
  }

  @Roles('ADMIN')
  @Patch('departments/:id')
  async updateDepartment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCodeNameDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    const before = await this.prisma.department.findUniqueOrThrow({ where: { id } });
    const after = await this.prisma.department.update({ where: { id }, data: dto });
    await this.log(actor, req, 'DEPARTMENT_UPDATED', 'Department', id, before, after);
    return after;
  }

  @Roles('ADMIN')
  @Delete('departments/:id')
  @HttpCode(204)
  async deleteDepartment(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    const before = await this.prisma.department.delete({ where: { id } });
    await this.log(actor, req, 'DEPARTMENT_DELETED', 'Department', id, before, null);
  }

  @Roles('ADMIN')
  @Post('promotions')
  async createPromotion(@Body() dto: PromotionDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    const promotion = await this.prisma.promotion.create({ data: dto });
    await this.log(actor, req, 'PROMOTION_CREATED', 'Promotion', promotion.id, null, promotion);
    return promotion;
  }

  @Roles('ADMIN')
  @Patch('promotions/:id')
  async updatePromotion(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePromotionDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    const before = await this.prisma.promotion.findUniqueOrThrow({ where: { id } });
    const after = await this.prisma.promotion.update({ where: { id }, data: dto });
    await this.log(actor, req, 'PROMOTION_UPDATED', 'Promotion', id, before, after);
    return after;
  }

  @Roles('ADMIN')
  @Delete('promotions/:id')
  @HttpCode(204)
  async deletePromotion(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    const before = await this.prisma.promotion.delete({ where: { id } });
    await this.log(actor, req, 'PROMOTION_DELETED', 'Promotion', id, before, null);
  }

  private log(actor: AuthUser, req: Request, action: string, entityType: string, entityId: string, before: unknown, after: unknown) {
    return this.audit.log({ actorId: actor.id, action, entityType, entityId, before, after, ip: req.ip ?? null });
  }
}
