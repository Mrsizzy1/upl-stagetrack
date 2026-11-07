/** Calcul des bornes de période des rapports (module pur). Semaine : lundi → dimanche. */
import { addDays, isoWeekdayOf } from '../../common/dates';
import { parseLocalDate } from '../time/zoned-time';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface DateRange {
  from: string;
  to: string;
}

export function periodRange(period: ReportPeriod, date: string, to?: string): DateRange {
  parseLocalDate(date);
  switch (period) {
    case 'daily':
      return { from: date, to: date };
    case 'weekly': {
      const monday = addDays(date, 1 - isoWeekdayOf(date));
      return { from: monday, to: addDays(monday, 6) };
    }
    case 'monthly': {
      const { year, month } = parseLocalDate(date);
      const first = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
      return { from: first, to: addDays(nextMonth, -1) };
    }
    case 'custom': {
      if (!to) throw new Error('La date de fin est obligatoire pour une période personnalisée');
      parseLocalDate(to);
      if (to < date) throw new Error('La date de fin précède la date de début');
      if (daysBetween(date, to) > 366) throw new Error('Une période ne peut pas dépasser 366 jours');
      return { from: date, to };
    }
  }
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Taux de présence en pourcentage, une décimale ; null si rien n'est attendu. */
export function attendanceRate(present: number, late: number, absent: number): number | null {
  const total = present + late + absent;
  if (total === 0) return null;
  return Math.round(((present + late) / total) * 1000) / 10;
}
