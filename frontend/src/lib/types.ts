/** Formes des réponses de l'API utilisées par l'interface. */
export type Role = 'ADMIN' | 'SUPERVISOR' | 'SCAN_AGENT' | 'STUDENT';
export type SessionType = 'MORNING' | 'EVENING';
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT';
export type StudentStatus = 'ACTIVE' | 'SUSPENDED' | 'COMPLETED';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  facultyId: string;
}
export interface Faculty {
  id: string;
  code: string;
  name: string;
  departments: Department[];
  _count?: { students: number };
}
export interface Promotion {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  _count?: { students: number };
}
export interface Reference {
  faculties: Faculty[];
  promotions: Promotion[];
}

export interface StudentListItem {
  id: string;
  matricule: string;
  lastName: string;
  middleName: string;
  firstName: string;
  status: StudentStatus;
  hasPhoto: boolean;
  faculty: { id: string; code: string; name: string };
  department: { id: string; code: string; name: string };
  promotion: { id: string; code: string; label: string };
  currentInternship: { startDate: string; endDate: string } | null;
}

export interface Internship {
  id: string;
  startDate: string;
  endDate: string;
  hostService: string | null;
  supervisor: { id: string; fullName: string } | null;
}

export interface StudentDetail extends Omit<StudentListItem, 'currentInternship'> {
  email: string | null;
  phone: string | null;
  enrolledAt: string;
  createdAt: string;
  account?: { id: string; username: string; isActive: boolean; lastLoginAt: string | null } | null;
  activeQrIssuedAt: string | null;
  internships: Internship[];
}

export interface AttendanceRow {
  id: string;
  date: string;
  sessionType: SessionType;
  status: AttendanceStatus;
  recordedAt: string | null;
  method: 'QR' | 'MANUAL' | 'SYSTEM';
  manualReason: string | null;
  isCorrected: boolean;
  recordedBy: { fullName: string } | null;
  student: {
    id: string;
    matricule: string;
    lastName: string;
    middleName: string;
    firstName: string;
    faculty: { code: string; name: string };
    department: { name: string };
    promotion: { label: string };
  };
  corrections: { previousStatus: AttendanceStatus; newStatus: AttendanceStatus; reason: string; createdAt: string; correctedBy: { fullName: string } }[];
}

export interface StudentHistory {
  from: string;
  to: string;
  items: AttendanceRow[];
  stats: { present: number; late: number; absent: number; total: number; rate: number | null };
}

export interface ScanResponse {
  result: string;
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

export interface LiveStatus {
  serverTime: string;
  timeZone: string;
  localDate: string;
  localTime: string;
  nonWorkingDay: string | null;
  openSession: SessionType | null;
  status: string;
  sessions: { sessionType: SessionType; opensAt: string; closesAt: string; recorded: number }[];
  /** Horaires en vigueur, avec leurs jours (« du lundi au vendredi »). */
  schedule: { sessionType: SessionType; opensAt: string; closesAt: string; days: string }[];
  /** Prochaine ouverture quand aucune session n'est ouverte. */
  nextSession: { date: string; sessionType: SessionType; opensAt: string; closesAt: string } | null;
}

export interface UserView {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
  role: { code: Role; label: string };
  student: { id: string; matricule: string } | null;
}

export interface ScheduleView {
  sessionType: SessionType;
  opensAt: string;
  closesAt: string;
  lateAfter: string | null;
  weekdays: number[];
  effectiveFrom: string;
}
