/**
 * Règles horaires pures. Les plages et jours proviennent de la configuration enregistrée.
 * La minute de fermeture est incluse. Un retard commence à la minute après le seuil configuré.
 * L'heure fournie par le service Clock est la seule utilisée pour décider d'un pointage.
 */
import { formatMinuteOfDay, localToInstant, toLocal } from '../time/zoned-time';

export type SessionType = 'MORNING' | 'EVENING';

export interface SessionWindow {
  sessionType: SessionType;
  /** Première minute acceptée depuis minuit. */
  opensAtMinute: number;
  /** Dernière minute acceptée, incluse. */
  closesAtMinute: number;
  /** Dernière minute « à l'heure », incluse ; null = pas de retard. */
  lateAfterMinute: number | null;
  /** Jours ISO où la session a lieu (1 = lundi … 7 = dimanche). */
  activeWeekdays: readonly number[];
}

export type ScanTimeDecision =
  | { outcome: 'OPEN'; localDate: string; sessionType: SessionType; isLate: boolean }
  | { outcome: 'TOO_EARLY'; localDate: string; nextSessionType: SessionType; nextOpensAtMinute: number }
  | {
      outcome: 'SESSION_CLOSED';
      localDate: string;
      closedSessionType: SessionType;
      nextSessionType: SessionType | null;
      nextOpensAtMinute: number | null;
    }
  | { outcome: 'NO_SESSION'; localDate: string };

const LAST_MINUTE = 1439;

/** Contrôle la cohérence d'un ensemble d'horaires. Renvoie la liste des erreurs (vide si valide). */
export function validateWindows(windows: readonly SessionWindow[]): string[] {
  const errors: string[] = [];
  const seen = new Set<SessionType>();

  for (const w of windows) {
    const label = w.sessionType === 'MORNING' ? 'matin' : 'soir';
    if (seen.has(w.sessionType)) errors.push(`Session du ${label} définie deux fois`);
    seen.add(w.sessionType);

    for (const [name, value] of [
      ['ouverture', w.opensAtMinute],
      ['fermeture', w.closesAtMinute],
    ] as const) {
      if (!Number.isInteger(value) || value < 0 || value > LAST_MINUTE) {
        errors.push(`Heure de ${name} invalide pour la session du ${label}`);
      }
    }
    if (w.opensAtMinute > w.closesAtMinute) {
      errors.push(`La session du ${label} ferme avant d'ouvrir`);
    }
    if (w.lateAfterMinute !== null) {
      if (!Number.isInteger(w.lateAfterMinute) || w.lateAfterMinute < w.opensAtMinute || w.lateAfterMinute >= w.closesAtMinute) {
        errors.push(`Le seuil de retard du ${label} doit être compris entre l'ouverture et la minute précédant la fermeture`);
      }
    }
    const days = new Set(w.activeWeekdays);
    if (days.size !== w.activeWeekdays.length) errors.push(`Jour répété dans la session du ${label}`);
    for (const d of w.activeWeekdays) {
      if (!Number.isInteger(d) || d < 1 || d > 7) errors.push(`Jour invalide (${d}) dans la session du ${label}`);
    }
  }

  // Deux sessions actives le même jour ne doivent pas se chevaucher.
  const sorted = [...windows].sort((a, b) => a.opensAtMinute - b.opensAtMinute);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const sharesDay = prev.activeWeekdays.some((d) => cur.activeWeekdays.includes(d));
    if (sharesDay && cur.opensAtMinute <= prev.closesAtMinute) {
      errors.push('Les sessions du matin et du soir se chevauchent');
    }
  }
  return errors;
}

/** Sessions ayant lieu ce jour ISO, triées par heure d'ouverture. */
export function windowsForWeekday(windows: readonly SessionWindow[], isoWeekday: number): SessionWindow[] {
  return windows
    .filter((w) => w.activeWeekdays.includes(isoWeekday))
    .sort((a, b) => a.opensAtMinute - b.opensAtMinute);
}

/**
 * Décide si un scan reçu à `instant` (heure serveur) tombe dans une session ouverte.
 * La comparaison se fait à la minute : toutes les secondes d'une minute acceptée sont acceptées.
 */
export function evaluateScanTime(instant: Date, timeZone: string, windows: readonly SessionWindow[]): ScanTimeDecision {
  const local = toLocal(instant, timeZone);
  const today = windowsForWeekday(windows, local.isoWeekday);
  const m = local.minuteOfDay;

  if (today.length === 0) return { outcome: 'NO_SESSION', localDate: local.date };

  if (m < today[0].opensAtMinute) {
    return {
      outcome: 'TOO_EARLY',
      localDate: local.date,
      nextSessionType: today[0].sessionType,
      nextOpensAtMinute: today[0].opensAtMinute,
    };
  }

  for (let i = 0; i < today.length; i++) {
    const w = today[i];
    if (m >= w.opensAtMinute && m <= w.closesAtMinute) {
      return {
        outcome: 'OPEN',
        localDate: local.date,
        sessionType: w.sessionType,
        isLate: w.lateAfterMinute !== null && m > w.lateAfterMinute,
      };
    }
    const next = today[i + 1];
    if (m > w.closesAtMinute && (!next || m < next.opensAtMinute)) {
      return {
        outcome: 'SESSION_CLOSED',
        localDate: local.date,
        closedSessionType: w.sessionType,
        nextSessionType: next ? next.sessionType : null,
        nextOpensAtMinute: next ? next.opensAtMinute : null,
      };
    }
  }
  // Inatteignable si les horaires sont valides ; on refuse par sécurité.
  return { outcome: 'NO_SESSION', localDate: local.date };
}

/**
 * Bornes absolues d'une session pour une date locale.
 * `closesAt` et `lateFrom` sont des bornes exclusives / de début :
 *  - accepté si opensAt <= t < closesAt ;
 *  - en retard si lateFrom !== null et t >= lateFrom.
 */
export function sessionBounds(
  localDate: string,
  window: SessionWindow,
  timeZone: string,
): { opensAt: Date; closesAt: Date; lateFrom: Date | null } {
  return {
    opensAt: localToInstant(localDate, window.opensAtMinute, timeZone),
    closesAt: localToInstant(localDate, window.closesAtMinute + 1, timeZone),
    lateFrom: window.lateAfterMinute === null ? null : localToInstant(localDate, window.lateAfterMinute + 1, timeZone),
  };
}

/* ------------------------------------------------------------------ Formulation des refus
 * Un refus doit dire à l'agent pourquoi et quand pointer : jour de la semaine, jours de pointage,
 * prochaine session (date et heure). Les règles elles-mêmes ne changent pas.
 */
export const WEEKDAY_NAMES = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
const MONTH_NAMES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « du lundi au vendredi », « le samedi », « lundi, mercredi et vendredi », « tous les jours ». */
export function formatWeekdays(days: readonly number[]): string {
  const sorted = [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (sorted.length === 0) return 'aucun jour';
  if (sorted.length === 7) return 'tous les jours';
  if (sorted.length === 1) return `le ${WEEKDAY_NAMES[sorted[0]]}`;
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (consecutive && sorted.length >= 3) return `du ${WEEKDAY_NAMES[sorted[0]]} au ${WEEKDAY_NAMES[sorted[sorted.length - 1]]}`;
  const names = sorted.map((d) => WEEKDAY_NAMES[d]);
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

/** « lundi 9 novembre » (date locale AAAA-MM-JJ, jour ISO fourni). */
export function formatLongDate(localDate: string, isoWeekday: number): string {
  const [, month, day] = localDate.split('-').map(Number);
  return `${WEEKDAY_NAMES[isoWeekday]} ${day} ${MONTH_NAMES[month - 1]}`;
}

export interface NextOpening {
  date: string;
  isoWeekday: number;
  sessionType: SessionType;
  opensAtMinute: number;
  closesAtMinute: number;
}

/** Decrit la prochaine session issue des horaires configures; null si aucune n'est programmee. */
export function describeNextOpening(next: NextOpening | null, today: string, tomorrow: string): string {
  if (!next) return 'Aucune session programmée dans les trois prochaines semaines.';
  const when =
    next.date === today
      ? "aujourd'hui"
      : next.date === tomorrow
        ? `demain (${formatLongDate(next.date, next.isoWeekday)})`
        : formatLongDate(next.date, next.isoWeekday);
  const label = next.sessionType === 'MORNING' ? 'matin' : 'soir';
  return `Prochaine session : ${when} à ${formatMinuteOfDay(next.opensAtMinute)} (${label}, jusqu'à ${formatMinuteOfDay(next.closesAtMinute)}).`;
}

/** Message affiché à l'agent pour une décision horaire refusée. */
export function describeRefusal(decision: Exclude<ScanTimeDecision, { outcome: 'OPEN' }>): string {
  const label = (t: SessionType) => (t === 'MORNING' ? 'du matin' : 'du soir');
  switch (decision.outcome) {
    case 'TOO_EARLY':
      return `Pointage trop tôt : la session ${label(decision.nextSessionType)} ouvre à ${formatMinuteOfDay(decision.nextOpensAtMinute)}.`;
    case 'SESSION_CLOSED':
      return decision.nextSessionType && decision.nextOpensAtMinute !== null
        ? `Session ${label(decision.closedSessionType)} fermée. Prochaine session ${label(decision.nextSessionType)} à ${formatMinuteOfDay(decision.nextOpensAtMinute)}.`
        : `Session fermée : plus aucun pointage possible aujourd'hui.`;
    case 'NO_SESSION':
      return "Aucune session de pointage aujourd'hui.";
  }
}
