/**
 * Horaires versionnés et jours non travaillés.
 * Une modification d'horaire crée une nouvelle version à partir d'une date future :
 * l'historique et les sessions déjà créées ne sont jamais réécrits.
 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SessionType } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth/auth.decorators';
import { Clock } from '../common/clock/clock';
import { addDays, fromDbDate, isoWeekdayOf, toDbDate } from '../common/dates';
import {
  describeNextOpening,
  describeRefusal,
  formatWeekdays,
  NextOpening,
  ScanTimeDecision,
  SessionWindow,
  validateWindows,
  WEEKDAY_NAMES,
} from '../domain/attendance/schedule-rules';
import { formatMinuteOfDay, toLocal } from '../domain/time/zoned-time';
import { PrismaService } from '../prisma/prisma.service';
import { NonWorkingDayDto, UpdateSchedulesDto } from './attendance.dto';

export interface ScheduledWindow extends SessionWindow {
  scheduleId: string;
  effectiveFrom: string;
}

export interface DayPlan {
  date: string;
  nonWorkingDay: string | null;
  windows: ScheduledWindow[];
}

const SESSION_TYPES: SessionType[] = ['MORNING', 'EVENING'];

export function parseClock(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new BadRequestException({ code: 'INVALID_TIME', message: `Heure invalide : ${value} (format HH:MM)` });
  return Number(match[1]) * 60 + Number(match[2]);
}

const clockText = (minute: number | null) => (minute === null ? null : formatMinuteOfDay(minute).replace('h', ':'));

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
    private readonly config: ConfigService,
  ) {}

  get timeZone(): string {
    return this.config.getOrThrow<string>('APP_TIMEZONE');
  }

  today(): string {
    return toLocal(this.clock.now(), this.timeZone).date;
  }

  /** Horaires en vigueur à une date locale, et jour non travaillé éventuel. */
  async dayPlan(date: string): Promise<DayPlan> {
    const dbDate = toDbDate(date);
    const [schedules, holiday] = await Promise.all([
      Promise.all(
        SESSION_TYPES.map((sessionType) =>
          this.prisma.attendanceSchedule.findFirst({
            where: { sessionType, effectiveFrom: { lte: dbDate } },
            orderBy: { effectiveFrom: 'desc' },
          }),
        ),
      ),
      this.prisma.nonWorkingDay.findUnique({ where: { date: dbDate } }),
    ]);
    return {
      date,
      nonWorkingDay: holiday?.label ?? null,
      windows: schedules
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => ({
          scheduleId: s.id,
          effectiveFrom: fromDbDate(s.effectiveFrom),
          sessionType: s.sessionType,
          opensAtMinute: s.opensAtMinute,
          closesAtMinute: s.closesAtMinute,
          lateAfterMinute: s.lateAfterMinute,
          activeWeekdays: s.activeWeekdays,
        })),
    };
  }

  /**
   * Prochaine ouverture de session strictement après `now` (heure serveur), en tenant compte des
   * versions d'horaires, des jours actifs et des jours non travaillés. Recherche sur 21 jours.
   */
  async nextOpening(now: Date): Promise<NextOpening | null> {
    const local = toLocal(now, this.timeZone);
    for (let offset = 0; offset <= 21; offset++) {
      const date = addDays(local.date, offset);
      const plan = await this.dayPlan(date);
      if (plan.nonWorkingDay) continue;
      const weekday = isoWeekdayOf(date);
      const next = plan.windows
        .filter((w) => w.activeWeekdays.includes(weekday) && (offset > 0 || w.opensAtMinute > local.minuteOfDay))
        .sort((a, b) => a.opensAtMinute - b.opensAtMinute)[0];
      if (next) {
        return { date, isoWeekday: weekday, sessionType: next.sessionType, opensAtMinute: next.opensAtMinute, closesAtMinute: next.closesAtMinute };
      }
    }
    return null;
  }

  /**
   * Explication complète d'un refus horaire : raison du jour (week-end, jour non travaillé, session fermée)
   * et date/heure de la prochaine session. Utilisée par le scan et par l'écran de pointage.
   */
  async explainRefusal(now: Date, plan: DayPlan, decision: Exclude<ScanTimeDecision, { outcome: 'OPEN' }> | null): Promise<string> {
    const local = toLocal(now, this.timeZone);
    const next = describeNextOpening(await this.nextOpening(now), local.date, addDays(local.date, 1));
    if (plan.nonWorkingDay) return `Jour non travaillé : ${plan.nonWorkingDay}. ${next}`;
    if (!decision) return next;
    if (decision.outcome === 'NO_SESSION') {
      const days = plan.windows.flatMap((w) => [...w.activeWeekdays]);
      return `Pas de pointage le ${WEEKDAY_NAMES[local.isoWeekday]} : les sessions ont lieu ${formatWeekdays(days)}. ${next}`;
    }
    if (decision.outcome === 'SESSION_CLOSED' && !decision.nextSessionType) return `${describeRefusal(decision)} ${next}`;
    return describeRefusal(decision);
  }

  /** Horaires actuels et versions programmées, au format lisible HH:MM. */
  async overview() {
    const today = this.today();
    const current = await this.dayPlan(today);
    const upcoming = await this.prisma.attendanceSchedule.findMany({
      where: { effectiveFrom: { gt: toDbDate(today) } },
      orderBy: [{ effectiveFrom: 'asc' }, { sessionType: 'asc' }],
    });
    const view = (w: { sessionType: SessionType; opensAtMinute: number; closesAtMinute: number; lateAfterMinute: number | null; activeWeekdays: readonly number[] }) => ({
      sessionType: w.sessionType,
      opensAt: clockText(w.opensAtMinute),
      closesAt: clockText(w.closesAtMinute),
      lateAfter: clockText(w.lateAfterMinute),
      weekdays: w.activeWeekdays,
    });
    return {
      today,
      timeZone: this.timeZone,
      current: current.windows.map((w) => ({ ...view(w), effectiveFrom: w.effectiveFrom })),
      upcoming: upcoming.map((s) => ({ ...view(s), effectiveFrom: fromDbDate(s.effectiveFrom) })),
    };
  }

  async update(dto: UpdateSchedulesDto, actor: AuthUser, ip: string | null) {
    const today = this.today();
    if (dto.effectiveFrom <= today) {
      throw new BadRequestException({
        code: 'EFFECTIVE_DATE',
        message: "Un nouvel horaire s'applique au plus tôt demain : les sessions du jour ne changent pas en cours de route.",
      });
    }
    const windows: SessionWindow[] = [
      {
        sessionType: 'MORNING',
        opensAtMinute: parseClock(dto.morning.opensAt),
        closesAtMinute: parseClock(dto.morning.closesAt),
        lateAfterMinute: dto.morning.lateAfter ? parseClock(dto.morning.lateAfter) : null,
        activeWeekdays: dto.morning.weekdays,
      },
      {
        sessionType: 'EVENING',
        opensAtMinute: parseClock(dto.evening.opensAt),
        closesAtMinute: parseClock(dto.evening.closesAt),
        lateAfterMinute: dto.evening.lateAfter ? parseClock(dto.evening.lateAfter) : null,
        activeWeekdays: dto.evening.weekdays,
      },
    ];
    const errors = validateWindows(windows);
    if (errors.length > 0) throw new BadRequestException({ code: 'INVALID_SCHEDULE', message: errors.join('. '), details: errors });

    const effectiveFrom = toDbDate(dto.effectiveFrom);
    await this.prisma.$transaction(async (tx) => {
      for (const w of windows) {
        const data = {
          opensAtMinute: w.opensAtMinute,
          closesAtMinute: w.closesAtMinute,
          lateAfterMinute: w.lateAfterMinute,
          activeWeekdays: [...w.activeWeekdays],
          createdById: actor.id,
        };
        await tx.attendanceSchedule.upsert({
          where: { sessionType_effectiveFrom: { sessionType: w.sessionType, effectiveFrom } },
          update: data,
          create: { ...data, sessionType: w.sessionType, effectiveFrom },
        });
      }
      await this.audit.log(
        { actorId: actor.id, action: 'SCHEDULE_UPDATED', entityType: 'AttendanceSchedule', after: dto, ip },
        tx,
      );
    });
    return this.overview();
  }

  /** Supprime une version programmée qui n'est pas encore entrée en vigueur. */
  async cancelUpcoming(effectiveFrom: string, actor: AuthUser, ip: string | null) {
    if (effectiveFrom <= this.today()) {
      throw new BadRequestException({ code: 'EFFECTIVE_DATE', message: 'Seule une version future peut être annulée' });
    }
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.attendanceSchedule.deleteMany({ where: { effectiveFrom: toDbDate(effectiveFrom) } });
      if (count === 0) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Aucune version à cette date' });
      await this.audit.log({ actorId: actor.id, action: 'SCHEDULE_CANCELLED', entityType: 'AttendanceSchedule', after: { effectiveFrom }, ip }, tx);
    });
    return this.overview();
  }

  async listNonWorkingDays(from?: string) {
    const days = await this.prisma.nonWorkingDay.findMany({
      where: from ? { date: { gte: toDbDate(from) } } : undefined,
      orderBy: { date: 'asc' },
      include: { createdBy: { select: { fullName: true } } },
    });
    return days.map((d) => ({ id: d.id, date: fromDbDate(d.date), label: d.label, createdBy: d.createdBy?.fullName ?? null }));
  }

  async addNonWorkingDay(dto: NonWorkingDayDto, actor: AuthUser, ip: string | null) {
    if (dto.date < this.today()) {
      throw new BadRequestException({ code: 'PAST_DATE', message: 'Un jour passé ne peut pas être déclaré non travaillé ; utilisez les corrections.' });
    }
    const existingSession = await this.prisma.attendanceSession.count({ where: { date: toDbDate(dto.date) } });
    if (existingSession > 0) {
      throw new ConflictException({ code: 'SESSIONS_EXIST', message: 'Des pointages ont déjà été enregistrés ce jour-là.' });
    }
    try {
      const day = await this.prisma.nonWorkingDay.create({ data: { date: toDbDate(dto.date), label: dto.label, createdById: actor.id } });
      await this.audit.log({ actorId: actor.id, action: 'NON_WORKING_DAY_ADDED', entityType: 'NonWorkingDay', entityId: day.id, after: dto, ip });
      return { id: day.id, date: dto.date, label: day.label };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: 'ALREADY_DECLARED', message: 'Ce jour est déjà déclaré non travaillé' });
      }
      throw e;
    }
  }

  async removeNonWorkingDay(id: string, actor: AuthUser, ip: string | null) {
    const day = await this.prisma.nonWorkingDay.findUnique({ where: { id } });
    if (!day) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Jour introuvable' });
    if (fromDbDate(day.date) < this.today()) {
      throw new BadRequestException({ code: 'PAST_DATE', message: "Un jour passé reste dans l'historique" });
    }
    await this.prisma.nonWorkingDay.delete({ where: { id } });
    await this.audit.log({ actorId: actor.id, action: 'NON_WORKING_DAY_REMOVED', entityType: 'NonWorkingDay', entityId: id, before: { date: fromDbDate(day.date), label: day.label }, ip });
  }
}
