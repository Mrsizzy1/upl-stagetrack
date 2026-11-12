/**
 * Enregistrement d'un pointage. Ordre des contrôles (voir le diagramme de la Phase 1) :
 *   1. QR connu et actif (ou matricule existant pour la saisie manuelle)
 *   2. étudiant actif et en stage à la date du jour
 *   3. jour travaillé et session ouverte à l'heure du SERVEUR
 *   4. insertion protégée par la contrainte unique (étudiant, date, session)
 * Chaque tentative, acceptée ou refusée, est écrite dans ScanAttempt.
 */
import { Injectable, Logger } from '@nestjs/common';
import { AttendanceStatus, CaptureMethod, Prisma, SessionType } from '../generated/prisma/client';
import type { AuthUser } from '../common/auth/auth.decorators';
import { Clock } from '../common/clock/clock';
import { toDbDate } from '../common/dates';
import type { RequestMeta } from '../common/http/request-meta';
import { SCAN_MESSAGES, ScanResultCode } from '../domain/attendance/scan-result';
import { evaluateScanTime, formatWeekdays } from '../domain/attendance/schedule-rules';
import { toLocal } from '../domain/time/zoned-time';
import { PrismaService } from '../prisma/prisma.service';
import { QrService, ScanStudent } from '../qr/qr.service';
import { SchedulesService } from './schedules.service';
import { SessionsService } from './sessions.service';

export interface ScanResponse {
  result: ScanResultCode;
  accepted: boolean;
  message: string;
  serverTime: string;
  localDate: string;
  localTime: string;
  sessionType: SessionType | null;
  attendanceStatus: AttendanceStatus | null;
  recordedAt: string | null;
  student: {
    id: string;
    fullName: string;
    matricule: string;
    faculty: string;
    department: string;
    promotion: string;
    hasPhoto: boolean;
  } | null;
}

interface Outcome {
  result: ScanResultCode;
  message?: string;
  student?: ScanStudent | null;
  credentialId?: string | null;
  sessionType?: SessionType | null;
  attendanceId?: string | null;
  attendanceStatus?: AttendanceStatus | null;
  recordedAt?: Date | null;
}

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly qr: QrService,
    private readonly schedules: SchedulesService,
    private readonly sessions: SessionsService,
  ) {}

  async scanQr(text: string, agent: AuthUser, meta: RequestMeta): Promise<ScanResponse> {
    const now = this.clock.now();
    return this.finish(now, 'QR', agent, meta, null, async () => {
      const resolution = await this.qr.resolve(text);
      if (resolution.kind === 'INVALID') return { result: 'INVALID_QR' };
      if (resolution.kind === 'REVOKED') {
        return { result: 'REVOKED_QR', student: resolution.student, credentialId: resolution.credentialId };
      }
      return this.record(now, resolution.student, resolution.credentialId, 'QR', agent, null);
    });
  }

  async scanManual(matricule: string, reason: string, agent: AuthUser, meta: RequestMeta): Promise<ScanResponse> {
    const now = this.clock.now();
    return this.finish(now, 'MANUAL', agent, meta, reason, async () => {
      const student = await this.qr.findStudentByMatricule(matricule);
      if (!student) return { result: 'UNKNOWN_MATRICULE' };
      return this.record(now, student, null, 'MANUAL', agent, reason);
    });
  }

  private async record(
    now: Date,
    student: ScanStudent,
    credentialId: string | null,
    method: CaptureMethod,
    agent: AuthUser,
    manualReason: string | null,
  ): Promise<Outcome> {
    const base = { student, credentialId };
    if (student.status === 'SUSPENDED') return { ...base, result: 'STUDENT_SUSPENDED' };
    if (student.status === 'COMPLETED') return { ...base, result: 'NOT_EXPECTED' };

    const localDate = toLocal(now, this.schedules.timeZone).date;
    const inInternship = await this.prisma.internship.count({
      where: { studentId: student.id, startDate: { lte: toDbDate(localDate) }, endDate: { gte: toDbDate(localDate) } },
    });
    if (!inInternship) return { ...base, result: 'NOT_EXPECTED' };

    const plan = await this.schedules.dayPlan(localDate);
    if (plan.nonWorkingDay) {
      return { ...base, result: 'NO_SESSION', message: await this.schedules.explainRefusal(now, plan, null) };
    }
    const decision = evaluateScanTime(now, this.schedules.timeZone, plan.windows);
    if (decision.outcome !== 'OPEN') {
      // Refus horaire : le message précise la raison et la prochaine session (rien n'est enregistré).
      return { ...base, result: decision.outcome, message: await this.schedules.explainRefusal(now, plan, decision) };
    }

    const window = plan.windows.find((w) => w.sessionType === decision.sessionType)!;
    const session = await this.sessions.ensure(localDate, window);
    // Double contrôle sur les bornes figées de la session (horloge serveur uniquement).
    if (session.state === 'CLOSED' || now < session.opensAt || now >= session.closesAt) {
      return { ...base, result: 'SESSION_CLOSED', sessionType: session.sessionType };
    }
    const status: AttendanceStatus = session.lateFrom && now >= session.lateFrom ? 'LATE' : 'PRESENT';

    try {
      const attendance = await this.prisma.attendance.create({
        data: {
          studentId: student.id,
          sessionId: session.id,
          date: session.date,
          sessionType: session.sessionType,
          status,
          recordedAt: now,
          method,
          recordedById: agent.id,
          manualReason,
        },
      });
      return {
        ...base,
        result: 'ACCEPTED',
        message: status === 'LATE' ? 'Présence enregistrée, en retard.' : SCAN_MESSAGES.ACCEPTED,
        sessionType: session.sessionType,
        attendanceId: attendance.id,
        attendanceStatus: status,
        recordedAt: now,
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await this.prisma.attendance.findUnique({
          where: { studentId_date_sessionType: { studentId: student.id, date: session.date, sessionType: session.sessionType } },
        });
        const at = existing?.recordedAt ? toLocal(existing.recordedAt, this.schedules.timeZone) : null;
        return {
          ...base,
          result: 'ALREADY_RECORDED',
          message: at
            ? `Étudiant déjà pointé à ${String(at.hour).padStart(2, '0')}h${String(at.minute).padStart(2, '0')}.`
            : SCAN_MESSAGES.ALREADY_RECORDED,
          sessionType: session.sessionType,
          attendanceId: existing?.id ?? null,
          attendanceStatus: existing?.status ?? null,
          recordedAt: existing?.recordedAt ?? null,
        };
      }
      throw e;
    }
  }

  /** Exécute le contrôle, journalise la tentative quoi qu'il arrive, construit la réponse. */
  private async finish(
    now: Date,
    method: CaptureMethod,
    agent: AuthUser,
    meta: RequestMeta,
    manualReason: string | null,
    run: () => Promise<Outcome>,
  ): Promise<ScanResponse> {
    let outcome: Outcome | null = null;
    try {
      outcome = await run();
      return this.toResponse(now, outcome);
    } finally {
      await this.prisma.scanAttempt
        .create({
          data: {
            scannedAt: now,
            agentId: agent.id,
            studentId: outcome?.student?.id ?? null,
            credentialId: outcome?.credentialId ?? null,
            method,
            result: outcome?.result ?? 'INVALID_QR',
            sessionType: outcome?.sessionType ?? null,
            attendanceId: outcome?.attendanceId ?? null,
            ip: meta.ip,
            userAgent: manualReason ? `${meta.userAgent ?? ''} | motif: ${manualReason}`.slice(0, 500) : meta.userAgent,
          },
        })
        .catch((e: unknown) => this.logger.error(`Journalisation du scan impossible : ${(e as Error).message}`));
    }
  }

  private toResponse(now: Date, o: Outcome): ScanResponse {
    const local = toLocal(now, this.schedules.timeZone);
    const s = o.student;
    return {
      result: o.result,
      accepted: o.result === 'ACCEPTED',
      message: o.message ?? SCAN_MESSAGES[o.result],
      serverTime: now.toISOString(),
      localDate: local.date,
      localTime: `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}:${String(local.second).padStart(2, '0')}`,
      sessionType: o.sessionType ?? null,
      attendanceStatus: o.attendanceStatus ?? null,
      recordedAt: o.recordedAt ? o.recordedAt.toISOString() : null,
      // Un QR invalide ne révèle rien ; les autres refus montrent l'étudiant pour que l'agent l'informe.
      student: s
        ? {
            id: s.id,
            fullName: `${s.lastName} ${s.middleName} ${s.firstName}`,
            matricule: s.matricule,
            faculty: s.faculty.name,
            department: s.department.name,
            promotion: s.promotion.label,
            hasPhoto: Boolean(s.photoPath),
          }
        : null,
    };
  }

  /** État en direct pour l'écran de pointage. */
  async live() {
    const now = this.clock.now();
    const local = toLocal(now, this.schedules.timeZone);
    const plan = await this.schedules.dayPlan(local.date);
    const decision = plan.nonWorkingDay ? null : evaluateScanTime(now, this.schedules.timeZone, plan.windows);
    const counts = await this.prisma.attendance.groupBy({
      by: ['sessionType'],
      where: { date: toDbDate(local.date), recordedAt: { not: null } },
      _count: { _all: true },
    });
    const todays = plan.windows.filter((w) => w.activeWeekdays.includes(local.isoWeekday));
    const hhmm = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    const openSession = decision?.outcome === 'OPEN' ? decision.sessionType : null;
    const next = openSession ? null : await this.schedules.nextOpening(now);
    const status = openSession
      ? `Session du ${openSession === 'MORNING' ? 'matin' : 'soir'} ouverte`
      : await this.schedules.explainRefusal(now, plan, decision && decision.outcome !== 'OPEN' ? decision : null);
    return {
      serverTime: now.toISOString(),
      timeZone: this.schedules.timeZone,
      localDate: local.date,
      localTime: `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}:${String(local.second).padStart(2, '0')}`,
      nonWorkingDay: plan.nonWorkingDay,
      openSession,
      status,
      sessions: todays.map((w) => ({
        sessionType: w.sessionType,
        opensAt: hhmm(w.opensAtMinute),
        closesAt: hhmm(w.closesAtMinute),
        recorded: counts.find((c) => c.sessionType === w.sessionType)?._count._all ?? 0,
      })),
      // Horaires en vigueur (tous jours confondus) et prochaine ouverture : l'agent sait quand pointer.
      schedule: plan.windows.map((w) => ({ sessionType: w.sessionType, opensAt: hhmm(w.opensAtMinute), closesAt: hhmm(w.closesAtMinute), days: formatWeekdays(w.activeWeekdays) })),
      nextSession: next ? { date: next.date, sessionType: next.sessionType, opensAt: hhmm(next.opensAtMinute), closesAt: hhmm(next.closesAtMinute) } : null,
    };
  }
}
