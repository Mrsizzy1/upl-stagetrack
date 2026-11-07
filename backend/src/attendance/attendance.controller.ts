import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthUser, CurrentUser, Roles } from '../common/auth/auth.decorators';
import { requestMeta } from '../common/http/request-meta';
import {
  CorrectionDto,
  HistoryQueryDto,
  ListAttendanceQueryDto,
  ManualScanDto,
  NonWorkingDayDto,
  ScanDto,
  UpdateSchedulesDto,
} from './attendance.dto';
import { AttendanceService } from './attendance.service';
import { ScanService } from './scan.service';
import { SchedulesService } from './schedules.service';

@ApiTags('Pointage')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly scans: ScanService,
    private readonly attendance: AttendanceService,
  ) {}

  /** Seuls les agents et administrateurs pointent. Un compte étudiant reçoit 403 (garde globale). */
  @Roles('SCAN_AGENT', 'ADMIN')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post('scan')
  @HttpCode(200)
  scan(@Body() dto: ScanDto, @CurrentUser() agent: AuthUser, @Req() req: Request) {
    return this.scans.scanQr(dto.qr, agent, requestMeta(req));
  }

  @Roles('SCAN_AGENT', 'ADMIN')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('manual')
  @HttpCode(200)
  manual(@Body() dto: ManualScanDto, @CurrentUser() agent: AuthUser, @Req() req: Request) {
    return this.scans.scanManual(dto.matricule, dto.reason, agent, requestMeta(req));
  }

  @Roles('SCAN_AGENT', 'ADMIN', 'SUPERVISOR')
  @Get('live')
  live() {
    return this.scans.live();
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Get()
  list(@Query() query: ListAttendanceQueryDto) {
    return this.attendance.list(query);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Get('students/:studentId')
  history(@Param('studentId', ParseUUIDPipe) studentId: string, @Query() query: HistoryQueryDto) {
    return this.attendance.studentHistory(studentId, query.from, query.to);
  }

  /** Correction exceptionnelle : administrateur seulement, motif obligatoire, journalisée. */
  @Roles('ADMIN')
  @Post(':id/corrections')
  correct(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CorrectionDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.attendance.correct(id, dto, actor, req.ip ?? null);
  }
}

@ApiTags('Horaires')
@ApiBearerAuth()
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Roles('ADMIN', 'SUPERVISOR', 'SCAN_AGENT')
  @Get()
  overview() {
    return this.schedules.overview();
  }

  @Roles('ADMIN')
  @Put()
  update(@Body() dto: UpdateSchedulesDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.schedules.update(dto, actor, req.ip ?? null);
  }

  @Roles('ADMIN')
  @Delete('upcoming/:effectiveFrom')
  cancel(@Param('effectiveFrom') effectiveFrom: string, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.schedules.cancelUpcoming(effectiveFrom, actor, req.ip ?? null);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Get('non-working-days')
  nonWorkingDays(@Query('from') from?: string) {
    return this.schedules.listNonWorkingDays(from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined);
  }

  @Roles('ADMIN')
  @Post('non-working-days')
  addNonWorkingDay(@Body() dto: NonWorkingDayDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.schedules.addNonWorkingDay(dto, actor, req.ip ?? null);
  }

  @Roles('ADMIN')
  @Delete('non-working-days/:id')
  @HttpCode(204)
  async removeNonWorkingDay(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    await this.schedules.removeNonWorkingDay(id, actor, req.ip ?? null);
  }
}
