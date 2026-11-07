/**
 * Tableau de bord et rapports. Toutes les valeurs sont calculées à partir des pointages en base ;
 * aucun chiffre n'est estimé ni inventé.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { addDays, fromDbDate, toDbDate } from '../common/dates';
import {
  drawDocumentHeader,
  drawPageFooters,
  renderPdf,
  SYSTEM_NAME,
  UNIVERSITY_NAME,
  UPL_BLUE,
  UPL_BLUE_LIGHT,
  UPL_GOLD,
  UPL_GOLD_LIGHT,
  UPL_INK,
  uplLogo,
} from '../common/pdf';
import { attendanceRate, periodRange } from '../domain/reports/periods';
import { SchedulesService } from '../attendance/schedules.service';
import { Clock } from '../common/clock/clock';
import { toLocal } from '../domain/time/zoned-time';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardQueryDto, ReportQueryDto } from './reports.dto';

export interface ReportRow {
  key: string;
  label: string;
  present: number;
  late: number;
  absent: number;
  total: number;
  rate: number | null;
}

export interface Report {
  title: string;
  from: string;
  to: string;
  groupBy: ReportQueryDto['groupBy'];
  filters: string[];
  rows: ReportRow[];
  totals: Omit<ReportRow, 'key' | 'label'>;
  generatedAt: string;
}

const GROUP_LABELS: Record<ReportQueryDto['groupBy'], string> = {
  student: 'Étudiant',
  faculty: 'Faculté',
  promotion: 'Promotion',
  session: 'Session',
  day: 'Jour',
};
const PERIOD_LABELS: Record<ReportQueryDto['period'], string> = {
  daily: 'journalier',
  weekly: 'hebdomadaire',
  monthly: 'mensuel',
  custom: 'sur période',
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedules: SchedulesService,
    private readonly clock: Clock,
    private readonly config: ConfigService,
  ) {}

  private studentFilter(q: DashboardQueryDto & { studentId?: string }): Prisma.StudentWhereInput {
    return { facultyId: q.facultyId, departmentId: q.departmentId, promotionId: q.promotionId, ...(q.studentId ? { id: q.studentId } : {}) };
  }

  async dashboard(q: DashboardQueryDto) {
    const date = q.date ?? this.schedules.today();
    const student = this.studentFilter(q);
    const day = toDbDate(date);
    const trendFrom = addDays(date, -13);

    const [totalStudents, byStatus, sessions, recent, trendRows] = await Promise.all([
      this.prisma.student.count({ where: { ...student, status: 'ACTIVE' } }),
      this.prisma.attendance.groupBy({ by: ['sessionType', 'status'], where: { date: day, student }, _count: { _all: true } }),
      this.prisma.attendanceSession.findMany({ where: { date: day } }),
      this.prisma.attendance.findMany({
        where: { date: day, recordedAt: { not: null }, student },
        orderBy: { recordedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          sessionType: true,
          status: true,
          recordedAt: true,
          method: true,
          student: { select: { id: true, matricule: true, lastName: true, middleName: true, firstName: true, faculty: { select: { code: true } } } },
        },
      }),
      this.prisma.attendance.groupBy({
        by: ['date', 'status'],
        where: { date: { gte: toDbDate(trendFrom), lte: day }, student },
        _count: { _all: true },
      }),
    ]);

    const count = (sessionType: string | null, status: string) =>
      byStatus
        .filter((r) => (sessionType === null || r.sessionType === sessionType) && r.status === status)
        .reduce((sum, r) => sum + r._count._all, 0);
    const session = (type: 'MORNING' | 'EVENING') => {
      const s = sessions.find((x) => x.sessionType === type);
      return {
        state: s ? s.state : 'NOT_STARTED',
        present: count(type, 'PRESENT') + count(type, 'LATE'),
        late: count(type, 'LATE'),
        absent: count(type, 'ABSENT'),
      };
    };

    const trend: { date: string; present: number; late: number; absent: number; rate: number | null }[] = [];
    for (let d = trendFrom; d <= date; d = addDays(d, 1)) {
      const rows = trendRows.filter((r) => fromDbDate(r.date) === d);
      const c = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
      trend.push({ date: d, present: c('PRESENT'), late: c('LATE'), absent: c('ABSENT'), rate: attendanceRate(c('PRESENT'), c('LATE'), c('ABSENT')) });
    }

    const present = count(null, 'PRESENT');
    const late = count(null, 'LATE');
    const absent = count(null, 'ABSENT');
    const closedRate = () => {
      const closed = sessions.filter((s) => s.state === 'CLOSED').map((s) => s.sessionType as string);
      if (closed.length === 0) return null;
      const sum = (status: string) => closed.reduce((total, type) => total + count(type, status), 0);
      return attendanceRate(sum('PRESENT'), sum('LATE'), sum('ABSENT'));
    };
    return {
      date,
      totalStudents,
      morning: session('MORNING'),
      evening: session('EVENING'),
      absent,
      late,
      // Le taux ne porte que sur les sessions clôturées : avant la clôture, les absents ne sont pas encore connus.
      rate: closedRate(),
      present,
      recent,
      trend,
    };
  }

  async build(q: ReportQueryDto): Promise<Report> {
    let range;
    try {
      range = periodRange(q.period, q.date, q.to);
    } catch (e) {
      throw new BadRequestException({ code: 'INVALID_PERIOD', message: (e as Error).message });
    }
    const rows = await this.prisma.attendance.findMany({
      where: {
        date: { gte: toDbDate(range.from), lte: toDbDate(range.to) },
        sessionType: q.sessionType,
        student: this.studentFilter(q),
      },
      select: {
        date: true,
        sessionType: true,
        status: true,
        student: {
          select: {
            id: true,
            matricule: true,
            lastName: true,
            middleName: true,
            firstName: true,
            faculty: { select: { id: true, name: true } },
            promotion: { select: { id: true, label: true, sortOrder: true } },
          },
        },
      },
    });

    const groups = new Map<string, ReportRow & { sort: string }>();
    for (const r of rows) {
      let key: string;
      let label: string;
      let sort: string;
      switch (q.groupBy) {
        case 'student':
          key = r.student.id;
          label = `${r.student.lastName} ${r.student.middleName} ${r.student.firstName} (${r.student.matricule})`;
          sort = label;
          break;
        case 'faculty':
          key = r.student.faculty.id;
          label = r.student.faculty.name;
          sort = label;
          break;
        case 'promotion':
          key = r.student.promotion.id;
          label = r.student.promotion.label;
          sort = String(r.student.promotion.sortOrder).padStart(5, '0');
          break;
        case 'session':
          key = r.sessionType;
          label = r.sessionType === 'MORNING' ? 'Matin' : 'Soir';
          sort = key === 'MORNING' ? '0' : '1';
          break;
        case 'day':
          key = fromDbDate(r.date);
          label = key;
          sort = key;
          break;
      }
      const g = groups.get(key) ?? { key, label, sort, present: 0, late: 0, absent: 0, total: 0, rate: null };
      if (r.status === 'PRESENT') g.present++;
      else if (r.status === 'LATE') g.late++;
      else g.absent++;
      g.total++;
      groups.set(key, g);
    }
    const list = [...groups.values()]
      .map((g) => ({ ...g, rate: attendanceRate(g.present, g.late, g.absent) }))
      .sort((a, b) => a.sort.localeCompare(b.sort, 'fr'))
      .map(({ sort: _sort, ...g }) => g);
    const totals = list.reduce(
      (t, g) => ({ present: t.present + g.present, late: t.late + g.late, absent: t.absent + g.absent, total: t.total + g.total, rate: null as number | null }),
      { present: 0, late: 0, absent: 0, total: 0, rate: null as number | null },
    );
    totals.rate = attendanceRate(totals.present, totals.late, totals.absent);

    return {
      title: `Rapport ${PERIOD_LABELS[q.period]} des présences par ${GROUP_LABELS[q.groupBy].toLowerCase()}`,
      from: range.from,
      to: range.to,
      groupBy: q.groupBy,
      filters: await this.describeFilters(q),
      rows: list,
      totals,
      generatedAt: this.clock.now().toISOString(),
    };
  }

  async xlsx(q: ReportQueryDto): Promise<Buffer> {
    const report = await this.build(q);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'UPL StageTrack';
    const ws = wb.addWorksheet('Rapport', { views: [{ showGridLines: false }] });
    const argb = (hex: string) => `FF${hex.slice(1).toUpperCase()}`;

    // En-tête institutionnel : logo à gauche (lignes 1 à 4), textes décalés à sa droite.
    const logo = uplLogo();
    const indent = logo ? 11 : 0;
    const head = (text: string, font: Partial<ExcelJS.Font>) => {
      const row = ws.addRow([text]);
      row.font = font;
      row.height = 18;
      row.getCell(1).alignment = { indent, vertical: 'middle' };
    };
    head(UNIVERSITY_NAME.toUpperCase(), { bold: true, size: 13, color: { argb: argb(UPL_BLUE) } });
    head(`${SYSTEM_NAME} — Gestion des présences des stagiaires`, { size: 10, color: { argb: argb(UPL_INK) } });
    head(report.title, { bold: true, size: 11, color: { argb: argb(UPL_INK) } });
    head(`Période : du ${report.from} au ${report.to}`, { size: 10 });
    if (logo) {
      const imageId = wb.addImage({ buffer: logo as unknown as ExcelJS.Buffer, extension: 'png' });
      ws.addImage(imageId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 66, height: 65 }, editAs: 'oneCell' });
    }
    const rule = ws.addRow([]);
    rule.height = 6;
    for (let c = 1; c <= 6; c++) rule.getCell(c).border = { bottom: { style: 'medium', color: { argb: argb(UPL_GOLD) } } };
    if (report.filters.length) ws.addRow([`Filtres : ${report.filters.join(' · ')}`]);
    ws.addRow([`Généré le ${this.localStamp(report.generatedAt)}`]).font = { italic: true, size: 9, color: { argb: 'FF2B3A7A' } };
    ws.addRow([]);

    const header = ws.addRow([GROUP_LABELS[report.groupBy], 'Présents', 'En retard', 'Absents', 'Total', 'Taux de présence (%)']);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(UPL_BLUE) } }));
    report.rows.forEach((r, i) => {
      const row = ws.addRow([r.label, r.present, r.late, r.absent, r.total, r.rate ?? '']);
      if (i % 2) row.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(UPL_BLUE_LIGHT) } }));
    });
    const total = ws.addRow(['Total', report.totals.present, report.totals.late, report.totals.absent, report.totals.total, report.totals.rate ?? '']);
    total.font = { bold: true };
    total.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(UPL_GOLD_LIGHT) } }));
    ws.columns = [{ width: 48 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 22 }];
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async pdf(q: ReportQueryDto): Promise<Buffer> {
    const report = await this.build(q);
    const margins = { top: 36, bottom: 50, left: 40, right: 40 };
    return renderPdf({ size: 'A4', margins, bufferPages: true, info: { Title: report.title, Author: UNIVERSITY_NAME, Creator: SYSTEM_NAME } }, (doc) => {
      const pageWidth = doc.page.width - margins.left - margins.right;
      const left = margins.left;

      doc.y = drawDocumentHeader(doc);
      doc.fillColor(UPL_INK).font('Helvetica-Bold').fontSize(12).text(report.title, left, doc.y, { width: pageWidth });
      doc.moveDown(0.3).font('Helvetica').fontSize(9).fillColor('#2B3A7A').text(`Période : du ${report.from} au ${report.to}`);
      if (report.filters.length) doc.text(`Filtres : ${report.filters.join(' · ')}`);
      doc.text(`Généré le ${this.localStamp(report.generatedAt)}`);
      doc.moveDown(0.8);

      const cols = [pageWidth - 5 * 62, 62, 62, 62, 62, 62];
      const headers = [GROUP_LABELS[report.groupBy], 'Présents', 'Retards', 'Absents', 'Total', 'Taux %'];
      const drawRow = (values: string[], bold = false, fill?: string, repeatHeader = true) => {
        if (doc.y > doc.page.height - margins.bottom - 24) {
          doc.addPage();
          doc.y = drawDocumentHeader(doc, true);
          if (repeatHeader) drawRow(headers, true, UPL_BLUE, false);
        }
        const y = doc.y;
        if (fill) doc.rect(left, y - 2, pageWidth, 16).fill(fill);
        let x = left;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(fill === UPL_BLUE ? '#FFFFFF' : UPL_INK);
        values.forEach((v, i) => {
          doc.text(v, x + 3, y + 2, { width: cols[i] - 6, align: i === 0 ? 'left' : 'right', lineBreak: false, ellipsis: true });
          x += cols[i];
        });
        doc.y = y + 16;
      };
      drawRow(headers, true, UPL_BLUE, false);
      report.rows.forEach((r, i) =>
        drawRow([r.label, String(r.present), String(r.late), String(r.absent), String(r.total), r.rate === null ? '—' : String(r.rate)], false, i % 2 ? UPL_BLUE_LIGHT : undefined),
      );
      const t = report.totals;
      drawRow(['Total', String(t.present), String(t.late), String(t.absent), String(t.total), t.rate === null ? '—' : String(t.rate)], true, UPL_GOLD_LIGHT);
      if (report.rows.length === 0) doc.moveDown().font('Helvetica-Oblique').fillColor(UPL_INK).text('Aucun pointage sur cette période.', left);
      drawPageFooters(doc, `${SYSTEM_NAME} · ${report.title}`);
    });
  }

  private localStamp(iso: string): string {
    const l = toLocal(new Date(iso), this.config.getOrThrow<string>('APP_TIMEZONE'));
    return `${l.date} à ${String(l.hour).padStart(2, '0')}h${String(l.minute).padStart(2, '0')}`;
  }

  private async describeFilters(q: ReportQueryDto): Promise<string[]> {
    const out: string[] = [];
    if (q.sessionType) out.push(q.sessionType === 'MORNING' ? 'Session du matin' : 'Session du soir');
    if (q.facultyId) out.push(`Faculté : ${(await this.prisma.faculty.findUnique({ where: { id: q.facultyId } }))?.name ?? '?'}`);
    if (q.departmentId) out.push(`Département : ${(await this.prisma.department.findUnique({ where: { id: q.departmentId } }))?.name ?? '?'}`);
    if (q.promotionId) out.push(`Promotion : ${(await this.prisma.promotion.findUnique({ where: { id: q.promotionId } }))?.label ?? '?'}`);
    if (q.studentId) {
      const s = await this.prisma.student.findUnique({ where: { id: q.studentId } });
      if (s) out.push(`Étudiant : ${s.lastName} ${s.middleName} ${s.firstName} (${s.matricule})`);
    }
    return out;
  }
}
