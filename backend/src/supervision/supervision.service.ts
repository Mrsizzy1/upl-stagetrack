import { buildSettingsUpdate } from '../domain/settings/settings-update';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser } from '../common/auth/auth.decorators';
import { Clock } from '../common/clock/clock';
import { toLocal } from '../domain/time/zoned-time';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './supervision.dto';

@Injectable()
export class SupervisionService {
  private readonly timeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
    private readonly config: ConfigService,
  ) {
    this.timeZone = this.config.get<string>('APP_TIMEZONE') ?? 'Africa/Lubumbashi';
  }

  /** Métriques transversales consolidées pour le tableau de bord de supervision centrale. */
  async getOverview() {
    const today = toLocal(this.clock.now(), this.timeZone).date;
    const todayDate = new Date(`${today}T00:00:00Z`);

    const [
      activeStudents,
      activeInternships,
      todayAttendances,
      allAttendancesCount,
      presentAttendancesCount,
      // Objets
      totalItems,
      lostItems,
      foundItems,
      pendingItems,
      claimRequestedItems,
      returnedItems,
      // Laboratoires et Parc
      labsCount,
      rowsCount,
      allMachines,
      activeInterventions,
      criticalInterventions,
    ] = await Promise.all([
      this.prisma.student.count({ where: { status: 'ACTIVE' } }),
      this.prisma.internship.count({
        where: {
          startDate: { lte: todayDate },
          endDate: { gte: todayDate },
        },
      }),
      this.prisma.attendance.findMany({
        where: { date: todayDate },
        select: { sessionType: true, status: true },
      }),
      this.prisma.attendance.count(),
      this.prisma.attendance.count({ where: { status: { in: ['PRESENT', 'LATE'] } } }),
      // Objets
      this.prisma.itemDeclaration.count(),
      this.prisma.itemDeclaration.count({ where: { type: 'LOST' } }),
      this.prisma.itemDeclaration.count({ where: { type: 'FOUND' } }),
      this.prisma.itemDeclaration.count({ where: { status: 'PENDING' } }),
      this.prisma.itemDeclaration.count({ where: { status: 'CLAIM_REQUESTED' } }),
      this.prisma.itemDeclaration.count({ where: { status: 'RETURNED' } }),
      // Labs & Machines
      this.prisma.laboratory.count({ where: { isActive: true } }),
      this.prisma.laboratoryRow.count(),
      this.prisma.machine.findMany({
        select: { id: true, generalStatus: true },
      }),
      this.prisma.technicalIntervention.count({ where: { status: { not: 'CLOSED' } } }),
      this.prisma.technicalIntervention.count({ where: { priority: 'CRITICAL', status: { not: 'CLOSED' } } }),
    ]);

    const attendancesToday = {
      total: todayAttendances.length,
      present: todayAttendances.filter((a) => a.status === 'PRESENT').length,
      late: todayAttendances.filter((a) => a.status === 'LATE').length,
      absent: todayAttendances.filter((a) => a.status === 'ABSENT').length,
      morningCount: todayAttendances.filter((a) => a.sessionType === 'MORNING').length,
      eveningCount: todayAttendances.filter((a) => a.sessionType === 'EVENING').length,
    };

    const attendanceRate =
      allAttendancesCount > 0 ? Math.round((presentAttendancesCount / allAttendancesCount) * 100) : null;

    const machines = {
      total: allMachines.length,
      functional: allMachines.filter((m) => m.generalStatus === 'FUNCTIONAL').length,
      toCheck: allMachines.filter((m) => m.generalStatus === 'TO_CHECK').length,
      defective: allMachines.filter((m) => m.generalStatus === 'DEFECTIVE').length,
      maintenance: allMachines.filter((m) => m.generalStatus === 'MAINTENANCE').length,
      outOfService: allMachines.filter((m) => m.generalStatus === 'OUT_OF_SERVICE').length,
      availabilityRate:
        allMachines.length > 0
          ? Math.round((allMachines.filter((m) => m.generalStatus === 'FUNCTIONAL').length / allMachines.length) * 100)
          : 100,
    };

    return {
      stages: {
        activeStudents,
        activeInternships,
        todayAttendances: attendancesToday,
        attendanceRate,
      },
      items: {
        total: totalItems,
        lost: lostItems,
        found: foundItems,
        pending: pendingItems,
        claimRequested: claimRequestedItems,
        returned: returnedItems,
      },
      labs: {
        laboratoriesCount: labsCount,
        rowsCount,
        machines,
        activeInterventions,
        criticalInterventions,
      },
      serverTime: new Date().toISOString(),
    };
  }

  /** Paramètres institutionnels configurables. */
  async getSettings() {
    let setting = await this.prisma.institutionSetting.findFirst();
    if (!setting) {
      setting = await this.prisma.institutionSetting.create({
        data: {
          institutionName: 'Université Protestante de Lubumbashi',
          facultyName: '',
          acronym: 'UPL',
          logoUrl: '/brand/upl-logo.png',
          portalSubtitle: 'Portail numérique unifié des services universitaires',
        },
      });
    }
    return setting;
  }

  async updateSettings(dto: UpdateSettingsDto, actor: AuthUser, ip?: string | null) {
    const current = await this.getSettings();

    const data = buildSettingsUpdate(dto);
    const updated = await this.prisma.institutionSetting.update({ where: { id: current.id }, data });

    await this.audit.log({
      actorId: actor.id,
      action: 'INSTITUTION_SETTINGS_UPDATED',
      entityType: 'InstitutionSetting',
      entityId: current.id,
      after: data,
      ip: ip ?? null,
    });

    return updated;
  }
}
