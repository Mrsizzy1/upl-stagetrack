/**
 * Clôture des sessions et calcul des absents.
 *
 * Chaque minute (et au démarrage, pour rattraper un arrêt du serveur), toute session dont
 * l'heure de fermeture est passée est clôturée :
 *   - un pointage ABSENT est créé pour chaque étudiant attendu qui n'a pas pointé ;
 *   - les compteurs sont figés dans AttendanceSession ;
 *   - l'opération est rejouable sans doublon (ON CONFLICT DO NOTHING + verrou consultatif).
 *
 * Étudiant attendu = statut ACTIVE, en stage ce jour-là, enregistré avant la fermeture.
 * Aucune session n'est créée avant la date d'entrée en vigueur du premier horaire.
 */
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditService } from '../common/audit/audit.service';
import { Clock } from '../common/clock/clock';
import { addDays, isoWeekdayOf } from '../common/dates';
import { sessionBounds } from '../domain/attendance/schedule-rules';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduledWindow, SchedulesService } from './schedules.service';
import { SessionsService } from './sessions.service';

/** Nombre de jours passés vérifiés à chaque passage (rattrapage après une panne). */
export const CATCH_UP_DAYS = 7;

@Injectable()
export class ClosureService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ClosureService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly schedules: SchedulesService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<boolean>('CLOSURE_JOB_ENABLED')) await this.tick();
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'session-closure' })
  async tick(): Promise<void> {
    if (!this.config.get<boolean>('CLOSURE_JOB_ENABLED') || this.running) return;
    this.running = true;
    try {
      const closed = await this.closeDueSessions();
      if (closed > 0) this.logger.log(`${closed} session(s) clôturée(s)`);
    } catch (e) {
      this.logger.error(`Échec de la clôture : ${(e as Error).message}`, (e as Error).stack);
    } finally {
      this.running = false;
    }
  }

  /** Clôture toutes les sessions échues des derniers jours. Renvoie le nombre de sessions clôturées. */
  async closeDueSessions(): Promise<number> {
    const now = this.clock.now();
    const today = this.schedules.today();
    let closed = 0;
    for (let offset = CATCH_UP_DAYS; offset >= 0; offset--) {
      const date = addDays(today, -offset);
      const plan = await this.schedules.dayPlan(date);
      if (plan.nonWorkingDay) continue;
      const weekday = isoWeekdayOf(date);
      for (const window of plan.windows) {
        if (!window.activeWeekdays.includes(weekday)) continue;
        if (sessionBounds(date, window, this.schedules.timeZone).closesAt > now) continue;
        if (await this.closeSession(date, window)) closed++;
      }
    }
    return closed;
  }

  /** Clôture une session ; false si elle l'était déjà. */
  async closeSession(date: string, window: ScheduledWindow): Promise<boolean> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`closure:${date}:${window.sessionType}`}))`;
        const session = await this.sessions.ensure(date, window, tx);
        if (session.state === 'CLOSED') return false;

        const absent = await tx.$executeRaw`
          INSERT INTO "Attendance" ("id", "studentId", "sessionId", "date", "sessionType", "status", "method", "updatedAt")
          SELECT gen_random_uuid(), s."id", ${session.id}::uuid, ${date}::date,
                 ${window.sessionType}::"SessionType", 'ABSENT'::"AttendanceStatus", 'SYSTEM'::"CaptureMethod", now()
          FROM "Student" s
          WHERE s."status" = 'ACTIVE'
            AND s."createdAt" < ${session.closesAt}
            AND EXISTS (
              SELECT 1 FROM "Internship" i
              WHERE i."studentId" = s."id" AND ${date}::date BETWEEN i."startDate" AND i."endDate"
            )
          ON CONFLICT ("studentId", "date", "sessionType") DO NOTHING`;

        const counts = await tx.attendance.groupBy({ by: ['status'], where: { sessionId: session.id }, _count: { _all: true } });
        const count = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;
        const present = count('PRESENT');
        const late = count('LATE');
        const absents = count('ABSENT');

        await tx.attendanceSession.update({
          where: { id: session.id },
          data: {
            state: 'CLOSED',
            closedAt: this.clock.now(),
            expectedCount: present + late + absents,
            presentCount: present,
            lateCount: late,
            absentCount: absents,
          },
        });
        await this.audit.log(
          {
            actorId: null,
            action: 'SESSION_CLOSED',
            entityType: 'AttendanceSession',
            entityId: session.id,
            after: { date, sessionType: window.sessionType, present, late, absent: absents, absencesCreated: absent },
          },
          tx,
        );
        return true;
      },
      { timeout: 60_000 },
    );
  }
}
