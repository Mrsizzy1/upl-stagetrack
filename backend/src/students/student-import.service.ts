/**
 * Import d'étudiants depuis un fichier CSV ou Excel (.xlsx).
 * Toujours en deux temps : simulation (rapport ligne par ligne), puis import réel.
 * L'import réel est « tout ou rien » : une seule erreur et rien n'est enregistré.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth/auth.decorators';
import { toDbDate } from '../common/dates';
import {
  detectCsvDelimiter,
  ImportError,
  missingColumns,
  REQUIRED_COLUMNS,
  validateImportRows,
} from '../domain/students/import-rows';
import { PrismaService } from '../prisma/prisma.service';
import { QrService } from '../qr/qr.service';

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export interface ImportReport {
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  created: number;
  errors: ImportError[];
  preview: { line: number; matricule: string; name: string }[];
}

export const IMPORT_TEMPLATE_CSV =
  '﻿matricule;nom;postnom;prenom;faculte;departement;promotion;email;telephone;date_inscription;debut_stage;fin_stage;service_accueil\n';

@Injectable()
export class StudentImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: QrService,
    private readonly audit: AuditService,
  ) {}

  async run(file: { originalname: string; buffer: Buffer }, dryRun: boolean, actor: AuthUser, ip: string | null): Promise<ImportReport> {
    const rawRows = await this.readFile(file);
    const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
    const missing = missingColumns(headers);
    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'IMPORT_COLUMNS',
        message: `Colonnes obligatoires absentes : ${missing.join(', ')}`,
        details: { required: REQUIRED_COLUMNS, found: headers },
      });
    }
    if (rawRows.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException({ code: 'IMPORT_TOO_LARGE', message: `${MAX_IMPORT_ROWS} lignes maximum par import` });
    }

    const [faculties, departments, promotions, existing] = await Promise.all([
      this.prisma.faculty.findMany({ select: { id: true, code: true } }),
      this.prisma.department.findMany({ select: { id: true, code: true, faculty: { select: { code: true } } } }),
      this.prisma.promotion.findMany({ select: { id: true, code: true } }),
      this.prisma.student.findMany({ select: { matricule: true } }),
    ]);
    const { rows, errors } = validateImportRows(rawRows, {
      faculties: new Map(faculties.map((f) => [f.code.toUpperCase(), f.id])),
      departments: new Map(departments.map((d) => [`${d.faculty.code.toUpperCase()}|${d.code.toUpperCase()}`, d.id])),
      promotions: new Map(promotions.map((p) => [p.code.toUpperCase(), p.id])),
      existingMatricules: new Set(existing.map((s) => s.matricule.toUpperCase())),
    });

    const report: ImportReport = {
      dryRun,
      totalRows: rows.length + new Set(errors.map((e) => e.line)).size,
      validRows: rows.length,
      created: 0,
      errors,
      preview: rows.slice(0, 20).map((r) => ({ line: r.line, matricule: r.matricule, name: `${r.lastName} ${r.middleName} ${r.firstName}` })),
    };
    if (dryRun || errors.length > 0 || rows.length === 0) return report;

    await this.prisma.$transaction(
      async (tx) => {
        for (const r of rows) {
          const student = await tx.student.create({
            data: {
              matricule: r.matricule,
              lastName: r.lastName,
              middleName: r.middleName,
              firstName: r.firstName,
              facultyId: r.facultyId,
              departmentId: r.departmentId,
              promotionId: r.promotionId,
              email: r.email,
              phone: r.phone,
              enrolledAt: toDbDate(r.enrolledAt),
            },
          });
          if (r.internship) {
            await tx.internship.create({
              data: {
                studentId: student.id,
                startDate: toDbDate(r.internship.startDate),
                endDate: toDbDate(r.internship.endDate),
                hostService: r.internship.hostService,
              },
            });
          }
          await this.qr.issue(tx, student.id, actor.id);
        }
        await this.audit.log(
          {
            actorId: actor.id,
            action: 'STUDENTS_IMPORTED',
            entityType: 'Student',
            after: { file: file.originalname, count: rows.length, matricules: rows.map((r) => r.matricule) },
            ip,
          },
          tx,
        );
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
    report.created = rows.length;
    return report;
  }

  private async readFile(file: { originalname: string; buffer: Buffer }): Promise<Record<string, unknown>[]> {
    const name = file.originalname.toLowerCase();
    if (name.endsWith('.csv')) {
      try {
        return parse(file.buffer, {
          columns: true,
          bom: true,
          skip_empty_lines: true,
          trim: true,
          // Un seul séparateur, déduit de la ligne d'entêtes : une virgule dans un champ d'un fichier
          // séparé par « ; » (« Direction, finances ») reste dans le champ.
          delimiter: detectCsvDelimiter(file.buffer),
          relax_column_count: true,
        }) as Record<string, unknown>[];
      } catch (e) {
        throw new BadRequestException({ code: 'IMPORT_PARSE', message: `Fichier CSV illisible : ${(e as Error).message}` });
      }
    }
    if (name.endsWith('.xlsx')) {
      const workbook = new ExcelJS.Workbook();
      try {
        await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
      } catch {
        throw new BadRequestException({ code: 'IMPORT_PARSE', message: 'Fichier Excel illisible' });
      }
      const sheet = workbook.worksheets[0];
      if (!sheet) return [];
      const headers: string[] = [];
      sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
        headers[col] = String(cellValue(cell.value) ?? '').trim();
      });
      const rows: Record<string, unknown>[] = [];
      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const record: Record<string, unknown> = {};
        headers.forEach((h, col) => {
          if (h) record[h] = cellValue(row.getCell(col).value);
        });
        rows.push(record);
      }
      return rows;
    }
    throw new BadRequestException({ code: 'IMPORT_FORMAT', message: 'Formats acceptés : .csv ou .xlsx' });
  }
}

/** Valeur exploitable d'une cellule Excel (texte riche, formule, lien, date). */
function cellValue(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((t) => t.text).join('');
    if ('result' in value) return value.result instanceof Date ? value.result : (value.result ?? null);
    if ('text' in value) return value.text;
    return null;
  }
  return value;
}
