/**
 * Conversion entre un instant absolu (Date, UTC) et l'heure locale d'un fuseau IANA.
 *
 * Module volontairement sans dépendance : il s'appuie sur l'API Intl de Node.js
 * (données ICU complètes incluses dans les binaires officiels). Il est testé seul,
 * sans base de données ni NestJS.
 *
 * Africa/Lubumbashi est en UTC+02:00 toute l'année (pas d'heure d'été), mais le code
 * reste correct pour un fuseau à heure d'été si l'UPL change un jour de référence.
 */

export interface LocalDateTime {
  /** Date locale au format ISO AAAA-MM-JJ. */
  date: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** Minutes écoulées depuis minuit local (0 à 1439). */
  minuteOfDay: number;
  /** Jour de la semaine ISO : 1 = lundi … 7 = dimanche. */
  isoWeekday: number;
}

const WEEKDAYS: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** Lève une erreur si le fuseau n'est pas un identifiant IANA reconnu. */
export function assertValidTimeZone(timeZone: string): void {
  try {
    formatterFor(timeZone);
  } catch {
    throw new Error(`Fuseau horaire inconnu : "${timeZone}"`);
  }
}

/** Heure locale, dans `timeZone`, de l'instant donné. */
export function toLocal(instant: Date, timeZone: string): LocalDateTime {
  if (Number.isNaN(instant.getTime())) {
    throw new Error('Instant invalide');
  }
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`Composant "${type}" absent du formatage`);
    return part.value;
  };
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  const second = Number(get('second'));
  const isoWeekday = WEEKDAYS[get('weekday')];
  if (!isoWeekday) throw new Error('Jour de la semaine non reconnu');

  return {
    date: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    year,
    month,
    day,
    hour,
    minute,
    second,
    minuteOfDay: hour * 60 + minute,
    isoWeekday,
  };
}

/** Décalage (en minutes) entre l'heure locale et UTC à cet instant. Lubumbashi : +120. */
export function offsetMinutes(instant: Date, timeZone: string): number {
  const local = toLocal(instant, timeZone);
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asUtc - truncated) / 60000);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Découpe et contrôle une date locale AAAA-MM-JJ. */
export function parseLocalDate(date: string): { year: number; month: number; day: number } {
  const match = ISO_DATE.exec(date);
  if (!match) throw new Error(`Date invalide : "${date}" (format attendu AAAA-MM-JJ)`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error(`Date inexistante : "${date}"`);
  }
  return { year, month, day };
}

/**
 * Instant absolu correspondant à `date` à `minuteOfDay` (heure locale de `timeZone`).
 * `minuteOfDay` peut valoir 1440 : c'est alors minuit du lendemain.
 */
export function localToInstant(date: string, minuteOfDay: number, timeZone: string): Date {
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay > 1440) {
    throw new Error(`Minute invalide : ${minuteOfDay}`);
  }
  const { year, month, day } = parseLocalDate(date);
  const naiveUtc = Date.UTC(year, month - 1, day, 0, minuteOfDay);
  let candidate = naiveUtc - offsetMinutes(new Date(naiveUtc), timeZone) * 60000;
  // Second passage : corrige le cas où le décalage diffère entre les deux instants (heure d'été).
  const corrected = naiveUtc - offsetMinutes(new Date(candidate), timeZone) * 60000;
  if (corrected !== candidate) candidate = corrected;
  return new Date(candidate);
}

/** Formate une minute du jour en « 07h45 ». */
export function formatMinuteOfDay(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
}
