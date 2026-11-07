/**
 * Espace étudiant : lecture seule de son propre dossier.
 * L'identifiant de l'étudiant vient du compte connecté, jamais d'un paramètre de l'URL :
 * un étudiant ne peut pas consulter le dossier d'un autre.
 */
import { Controller, ForbiddenException, Get, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Roles } from '../common/auth/auth.decorators';
import { QrService } from '../qr/qr.service';
import { StudentsService } from '../students/students.service';
import { HistoryQueryDto } from './attendance.dto';
import { AttendanceService } from './attendance.service';

@ApiTags('Espace étudiant')
@ApiBearerAuth()
@Roles('STUDENT')
@Controller('me')
export class MeController {
  constructor(
    private readonly students: StudentsService,
    private readonly attendance: AttendanceService,
    private readonly qr: QrService,
  ) {}

  private studentId(user: AuthUser): string {
    if (!user.studentId) throw new ForbiddenException({ code: 'NO_STUDENT_FILE', message: "Ce compte n'est lié à aucun dossier étudiant" });
    return user.studentId;
  }

  @Get('student')
  async profile(@CurrentUser() user: AuthUser) {
    const s = await this.students.get(this.studentId(user));
    return { ...s, account: undefined };
  }

  @Get('qr.png')
  async qrPng(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    const png = await this.qr.png(this.studentId(user));
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
    return new StreamableFile(png);
  }

  @Get('photo')
  async photo(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    const { buffer, contentType } = await this.students.photo(this.studentId(user));
    res.set({ 'Content-Type': contentType, 'Cache-Control': 'private, max-age=300' });
    return new StreamableFile(buffer);
  }

  @Get('attendance')
  history(@CurrentUser() user: AuthUser, @Query() query: HistoryQueryDto) {
    return this.attendance.studentHistory(this.studentId(user), query.from, query.to);
  }
}
