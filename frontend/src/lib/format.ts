/** Affichage. L'heure affichée est toujours celle de Lubumbashi ; elle ne sert jamais à une règle de pointage. */
export const TIME_ZONE = 'Africa/Lubumbashi';

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const longDateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: TIME_ZONE });
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

/** « 2026-11-09 » → « 09/11/2026 » (date calendaire, sans conversion de fuseau). */
export const formatDate = (localDate: string | null | undefined) => (localDate ? dateFmt.format(new Date(`${localDate}T00:00:00Z`)) : '—');
export const formatLongDate = (localDate: string) => longDateFmt.format(new Date(`${localDate}T00:00:00Z`));
export const formatTime = (iso: string | null | undefined) => (iso ? timeFmt.format(new Date(iso)) : '—');
export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTimeFmt.format(new Date(iso)) : '—');

/** Date du jour à Lubumbashi, au format AAAA-MM-JJ, pour préremplir les filtres. */
export function todayInLubumbashi(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
}

export const ROLE_LABELS = {
  ADMIN: 'Administrateur',
  SUPERVISOR: 'Responsable de stage',
  SCAN_AGENT: 'Agent de pointage',
  STUDENT: 'Étudiant',
} as const;

export const SESSION_LABELS = { MORNING: 'Matin', EVENING: 'Soir' } as const;

export const ATTENDANCE_LABELS = { PRESENT: 'Présent', LATE: 'En retard', ABSENT: 'Absent' } as const;

export const STUDENT_STATUS_LABELS = { ACTIVE: 'Actif', SUSPENDED: 'Suspendu', COMPLETED: 'Terminé' } as const;

export const METHOD_LABELS = { QR: 'QR Code', MANUAL: 'Saisie manuelle', SYSTEM: 'Clôture automatique' } as const;

export const WEEKDAYS = [
  { value: 1, short: 'Lun' },
  { value: 2, short: 'Mar' },
  { value: 3, short: 'Mer' },
  { value: 4, short: 'Jeu' },
  { value: 5, short: 'Ven' },
  { value: 6, short: 'Sam' },
  { value: 7, short: 'Dim' },
];

export const fullName = (s: { lastName: string; middleName: string; firstName: string }) =>
  `${s.lastName.toUpperCase()} ${s.middleName.toUpperCase()} ${s.firstName}`;
