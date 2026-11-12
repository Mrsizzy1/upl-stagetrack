import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma, ScanResult } from '../generated/prisma/client';
import type { Response } from 'express';
import { Roles } from '../common/auth/auth.decorators';
import { addDays } from '../common/dates';
import { paginate } from '../common/http/pagination.dto';
import { localToInstant } from '../domain/time/zoned-time';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AuditQueryDto, DashboardQueryDto, ReportQueryDto, ScanAttemptQueryDto } from './reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('Tableau de bord et rapports')
@ApiBearerAuth()
@Roles('ADMIN', 'SUPERVISOR')
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  dashboard(@Query() query: DashboardQueryDto) {
    return this.reports.dashboard(query);
  }

  @Get('reports')
  report(@Query() query: ReportQueryDto) {
    return this.reports.build(query);
  }

  @Get('reports/export.xlsx')
  async xlsx(@Query() query: ReportQueryDto, @Res({ passthrough: true }) res: Response) {
    const buffer = await this.reports.xlsx(query);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rapport-presences-${query.date}.xlsx"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('reports/export.pdf')
  async pdf(@Query() query: ReportQueryDto, @Res({ passthrough: true }) res: Response) {
    const buffer = await this.reports.pdf(query);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="rapport-presences-${query.date}.pdf"` });
    return new StreamableFile(buffer);
  }
}

@ApiTags("Journaux d'audit")
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('audit')
export class AuditController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private bounds(from?: string, to?: string) {
    const tz = this.config.getOrThrow<string>('APP_TIMEZONE');
    return {
      ...(from ? { gte: localToInstant(from, 0, tz) } : {}),
      ...(to ? { lt: localToInstant(addDays(to, 1), 0, tz) } : {}),
    };
  }

  @Get('logs')
  async logs(@Query() q: AuditQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      action: q.action ? { contains: q.action, mode: 'insensitive' } : undefined,
      entityType: q.entityType,
      entityId: q.entityId,
      at: q.from || q.to ? this.bounds(q.from, q.to) : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, orderBy: { at: 'desc' }, ...paginate(q) }),
      this.prisma.auditLog.count({ where }),
    ]);
    const actorIds = [...new Set(items.map((i) => i.actorId).filter((id): id is string => Boolean(id)))];
    const actors = await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true, username: true } });
    return {
      items: items.map((i) => ({ ...i, actor: actors.find((a) => a.id === i.actorId) ?? null })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  @Get('scans')
  async scans(@Query() q: ScanAttemptQueryDto) {
    const where: Prisma.ScanAttemptWhereInput = {
      result: q.result && q.result in ScanResult ? (q.result as ScanResult) : undefined,
      studentId: q.studentId,
      scannedAt: q.date ? this.bounds(q.date, q.date) : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.scanAttempt.findMany({ where, orderBy: { scannedAt: 'desc' }, ...paginate(q) }),
      this.prisma.scanAttempt.count({ where }),
    ]);
    const userIds = [...new Set(items.map((i) => i.agentId).filter((id): id is string => Boolean(id)))];
    const studentIds = [...new Set(items.map((i) => i.studentId).filter((id): id is string => Boolean(id)))];
    const [agents, students] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }),
      this.prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, matricule: true, lastName: true, firstName: true } }),
    ]);
    return {
      items: items.map((i) => ({
        ...i,
        agent: agents.find((a) => a.id === i.agentId) ?? null,
        student: students.find((s) => s.id === i.studentId) ?? null,
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }
}
