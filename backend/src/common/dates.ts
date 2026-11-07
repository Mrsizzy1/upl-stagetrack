/**
 * Conversion entre dates locales « AAAA-MM-JJ » et colonnes PostgreSQL `date`.
 * Prisma représente une colonne `date` par un objet Date à minuit UTC : on s'y tient partout.
 */
import { parseLocalDate } from '../domain/time/zoned-time';

export function toDbDate(localDate: string): Date {
  parseLocalDate(localDate);
  return new Date(`${localDate}T00:00:00.000Z`);
}

export function fromDbDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Ajoute `days` jours à une date locale. */
export function addDays(localDate: string, days: number): string {
  const d = toDbDate(localDate);
  d.setUTCDate(d.getUTCDate() + days);
  return fromDbDate(d);
}

/** Jour ISO (1 = lundi) d'une date locale. */
export function isoWeekdayOf(localDate: string): number {
  const day = toDbDate(localDate).getUTCDay();
  return day === 0 ? 7 : day;
}
