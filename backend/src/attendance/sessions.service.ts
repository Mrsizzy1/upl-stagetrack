/**
 * Sessions réelles (une par date et par type). Créées à la demande, au premier scan
 * ou à la clôture, avec les bornes horaires figées au moment de la création.
 */
import { Injectable } from '@nestjs/common';
import { AttendanceSession, Prisma } from '@prisma/client';
import { toDbDate } from '../common/dates';
import { sessionBounds } from '../domain/attendance/schedule-rules';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduledWindow, SchedulesService } from './schedules.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedules: SchedulesService,
  ) {}

  async ensure(date: string, window: ScheduledWindow, db: Db = this.prisma): Promise<AttendanceSession> {
    const key = { date_sessionType: { date: toDbDate(date), sessionType: window.sessionType } };
    const existing = await db.attendanceSession.findUnique({ where: key });
    if (existing) return existing;

    const bounds = sessionBounds(date, window, this.schedules.timeZone);
    try {
      return await db.attendanceSession.create({
        data: {
          date: toDbDate(date),
          sessionType: window.sessionType,
          scheduleId: window.scheduleId,
          opensAt: bounds.opensAt,
          closesAt: bounds.closesAt,
          lateFrom: bounds.lateFrom,
        },
      });
    } catch (e) {
      // Deux scans simultanés ont voulu créer la même session : on reprend celle qui a gagné.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return db.attendanceSession.findUniqueOrThrow({ where: key });
      }
      throw e;
    }
  }
}
