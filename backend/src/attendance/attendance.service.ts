/** Consultation des présences, historique par étudiant et corrections exceptionnelles. */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth/auth.decorators';
import { addDays, fromDbDate, toDbDate } from '../common/dates';
import { paginate } from '../common/http/pagination.dto';
import { attendanceRate } from '../domain/reports/periods';
import { PrismaService } from '../prisma/prisma.service';
import { CorrectionDto, ListAttendanceQueryDto } from './attendance.dto';
import { SchedulesService } from './schedules.service';

const rowSelect = {
  id: true,
  date: true,
  sessionType: true,
  status: true,
  recordedAt: true,
  method: true,
  manualReason: true,
  isCorrected: true,
  recordedBy: { select: { fullName: true } },
  student: {
    select: {
      id: true,
      matricule: true,
      lastName: true,
      middleName: true,
      firstName: true,
      faculty: { select: { code: true, name: true } },
      department: { select: { name: true } },
      promotion: { select: { label: true } },
    },
  },
  corrections: {
    orderBy: { createdAt: 'desc' },
    select: { previousStatus: true, newStatus: true, reason: true, createdAt: true, correctedBy: { select: { fullName: true } } },
  },
} satisfies Prisma.AttendanceSelect;

type Row = Prisma.AttendanceGetPayload<{ select: typeof rowSelect }>;
const view = (r: Row) => ({ ...r, date: fromDbDate(r.date) });

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly schedules: SchedulesService,
  ) {}

  async list(query: ListAttendanceQueryDto) {
    const words = (query.search ?? '').split(/\s+/).filter(Boolean).slice(0, 5);
    const where: Prisma.AttendanceWhereInput = {
      date: toDbDate(query.date),
      sessionType: query.sessionType,
      status: query.status,
      student: {
        facultyId: query.facultyId,
        departmentId: query.departmentId,
        promotionId: query.promotionId,
        AND: words.map((w) => ({
          OR: [
            { matricule: { contains: w, mode: 'insensitive' } },
            { lastName: { contains: w, mode: 'insensitive' } },
            { middleName: { contains: w, mode: 'insensitive' } },
            { firstName: { contains: w, mode: 'insensitive' } },
          ],
        })),
      },
    };
    const [items, total, sessions] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        select: rowSelect,
        orderBy: [{ sessionType: 'asc' }, { recordedAt: { sort: 'desc', nulls: 'last' } }, { student: { lastName: 'asc' } }],
        ...paginate(query),
      }),
      this.prisma.attendance.count({ where }),
      this.prisma.attendanceSession.findMany({ where: { date: toDbDate(query.date) }, orderBy: { sessionType: 'asc' } }),
    ]);
    return {
      items: items.map(view),
      total,
      page: query.page,
      pageSize: query.pageSize,
      sessions: sessions.map((s) => ({
        sessionType: s.sessionType,
        state: s.state,
        opensAt: s.opensAt,
        closesAt: s.closesAt,
        closedAt: s.closedAt,
        expectedCount: s.expectedCount,
        presentCount: s.presentCount,
        lateCount: s.lateCount,
        absentCount: s.absentCount,
      })),
    };
  }

  /** Historique et statistiques d'un étudiant sur une période (30 derniers jours par défaut). */
  async studentHistory(studentId: string, from?: string, to?: string) {
    const exists = await this.prisma.student.count({ where: { id: studentId } });
    if (!exists) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Étudiant introuvable' });
    const end = to ?? this.schedules.today();
    const start = from ?? addDays(end, -30);
    if (start > end) throw new BadRequestException({ code: 'INVALID_PERIOD', message: 'Période invalide' });

    const rows = await this.prisma.attendance.findMany({
      where: { studentId, date: { gte: toDbDate(start), lte: toDbDate(end) } },
      select: rowSelect,
      orderBy: [{ date: 'desc' }, { sessionType: 'asc' }],
    });
    // Statistiques de la période affichée (et non de tout l'historique).
    const count = (s: string) => rows.filter((r) => r.status === s).length;
    const present = count('PRESENT');
    const late = count('LATE');
    const absent = count('ABSENT');
    return {
      from: start,
      to: end,
      items: rows.map(view),
      stats: { present, late, absent, total: present + late + absent, rate: attendanceRate(present, late, absent) },
    };
  }

  async correct(attendanceId: string, dto: CorrectionDto, actor: AuthUser, ip: string | null) {
    const attendance = await this.prisma.attendance.findUnique({ where: { id: attendanceId } });
    if (!attendance) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Pointage introuvable' });
    if (attendance.status === dto.newStatus) {
      throw new BadRequestException({ code: 'STATUS_UNCHANGED', message: 'Le pointage a déjà ce statut' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.attendanceCorrection.create({
        data: {
          attendanceId,
          previousStatus: attendance.status,
          newStatus: dto.newStatus,
          reason: dto.reason,
          correctedById: actor.id,
        },
      });
      await tx.attendance.update({ where: { id: attendanceId }, data: { status: dto.newStatus, isCorrected: true } });
      // Les compteurs figés à la clôture suivent la correction.
      const session = await tx.attendanceSession.findUnique({ where: { id: attendance.sessionId } });
      if (session?.state === 'CLOSED') {
        const counts = await tx.attendance.groupBy({ by: ['status'], where: { sessionId: session.id }, _count: { _all: true } });
        const n = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
        await tx.attendanceSession.update({
          where: { id: session.id },
          data: {
            expectedCount: n('PRESENT') + n('LATE') + n('ABSENT'),
            presentCount: n('PRESENT'),
            lateCount: n('LATE'),
            absentCount: n('ABSENT'),
          },
        });
      }
      await this.audit.log(
        {
          actorId: actor.id,
          action: 'ATTENDANCE_CORRECTED',
          entityType: 'Attendance',
          entityId: attendanceId,
          before: { status: attendance.status },
          after: { status: dto.newStatus, reason: dto.reason },
          ip,
        },
        tx,
      );
    });
    return view(await this.prisma.attendance.findUniqueOrThrow({ where: { id: attendanceId }, select: rowSelect }));
  }
}
