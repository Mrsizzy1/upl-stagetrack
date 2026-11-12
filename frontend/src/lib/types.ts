/** Formes des réponses de l'API utilisées par l'interface. */
export type Role =
  | 'ADMIN'
  | 'SUPERVISOR'
  | 'SCAN_AGENT'
  | 'STUDENT'
  | 'SUPER_ADMIN'
  | 'FACULTY_ADMIN'
  | 'INTERNSHIP_MANAGER'
  | 'IT_TECHNICIAN'
  | 'INTERN';
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

// ----------------------------------------------------------------------------
// MODULE OBJETS PERDUS ET RETROUVÉS
// ----------------------------------------------------------------------------

export type ItemType = 'LOST' | 'FOUND';

export type ItemCategory =
  | 'ELECTRONICS'
  | 'DOCUMENTS'
  | 'BAGS'
  | 'CLOTHING'
  | 'KEYS'
  | 'JEWELRY'
  | 'BOOKS'
  | 'OTHER';

export type ItemStatus =
  | 'PENDING'
  | 'PUBLISHED'
  | 'CLAIM_REQUESTED'
  | 'APPROVED'
  | 'RETURNED'
  | 'REJECTED'
  | 'CLOSED';

export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PublicItemListItem {
  id: string;
  type: ItemType;
  title: string;
  category: ItemCategory;
  description: string;
  photoPath: string | null;
  eventDate: string;
  location: string;
  status: ItemStatus;
  createdAt: string;
}

export interface AdminItemListItem extends PublicItemListItem {
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  rejectionReason: string | null;
  createdBy?: { id: string; fullName: string; username: string } | null;
  approvedBy?: { id: string; fullName: string } | null;
  _count: { claims: number };
}

export interface ItemClaimItem {
  id: string;
  declarationId: string;
  claimantName: string;
  claimantPhone: string;
  claimantEmail: string | null;
  proofDescription: string;
  proofPhotoPath: string | null;
  status: ClaimStatus;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  reviewedBy?: { id: string; fullName: string } | null;
}

// ----------------------------------------------------------------------------
// MODULE LABORATOIRES ET MACHINES PAR QR CODE
// ----------------------------------------------------------------------------

export type MachineStatus = 'FUNCTIONAL' | 'TO_CHECK' | 'DEFECTIVE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';

export type ComponentState = 'FUNCTIONAL' | 'DEFECTIVE' | 'MISSING' | 'TO_CHECK' | 'NOT_APPLICABLE';

export type InterventionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type InterventionStatus = 'REPORTED' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'UNRESOLVED' | 'CLOSED';

export interface ComponentType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface MachineComponentItem {
  id: string;
  state: ComponentState;
  notes: string | null;
  componentType: ComponentType;
}

export interface MachineListItem {
  id: string;
  code: string;
  name: string;
  positionInRow: number;
  brand: string | null;
  model: string | null;
  generalStatus: MachineStatus;
  publicToken: string;
  lastControlAt: string | null;
  components?: MachineComponentItem[];
  _count?: { interventions: number };
}

export interface LaboratoryRow {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  machines?: MachineListItem[];
}

export interface LaboratoryListItem {
  id: string;
  code: string;
  name: string;
  building: string;
  location: string;
  description: string | null;
  isActive: boolean;
  manager?: { id: string; fullName: string; username: string } | null;
  rows?: LaboratoryRow[];
  _count: { machines: number; rows: number };
  stats: {
    total: number;
    functional: number;
    toCheck: number;
    defective: number;
    maintenance: number;
    outOfService: number;
  };
}

export interface MachineDetail extends MachineListItem {
  serialNumber: string | null;
  acquisitionDate: string | null;
  specifications: string | null;
  photoPath: string | null;
  laboratory: { id: string; code: string; name: string; building: string; location: string };
  row: { id: string; code: string; name: string; sortOrder: number };
  lastControlBy: { id: string; fullName: string } | null;
  components: MachineComponentItem[];
  interventions: {
    id: string;
    title: string;
    priority: InterventionPriority;
    status: InterventionStatus;
    reportedAt: string;
    technician: { id: string; fullName: string } | null;
  }[];
}

export interface MachineControlHistoryItem {
  id: string;
  controlledAt: string;
  generalStatus: MachineStatus;
  observations: string | null;
  photoPath: string | null;
  technician: { id: string; fullName: string; username: string };
  details: {
    id: string;
    componentName: string;
    previousState: ComponentState;
    newState: ComponentState;
    notes: string | null;
  }[];
}

export interface TechnicalInterventionItem {
  id: string;
  title: string;
  description: string;
  priority: InterventionPriority;
  status: InterventionStatus;
  reportedAt: string;
  startedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  resolutionReport: string | null;
  replacedParts: string | null;
  machine: {
    id: string;
    code: string;
    name: string;
    laboratory: { id: string; name: string; code: string };
    row: { code: string; name: string };
  } | null;
  machineCode: string;
  technician: { id: string; fullName: string } | null;
  reportedBy: { id: string; fullName: string } | null;
}

export interface PublicMachineView {
  code: string;
  name: string;
  laboratory: string;
  building: string;
  location: string;
  row: string;
  position: number;
  brand: string | null;
  model: string | null;
  specifications: string | null;
  generalStatus: MachineStatus;
  lastControlAt: string | null;
  components: {
    name: string;
    code: string;
    state: ComponentState;
  }[];
  missingComponents: string[];
  defectiveComponents: string[];
  toCheckComponents: string[];
}

export interface InstitutionSetting {
  id: string;
  institutionName: string;
  facultyName: string;
  acronym: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  portalSubtitle: string | null;
  updatedAt: string;
}

export interface SupervisionOverview {
  stages: {
    activeStudents: number;
    activeInternships: number;
    todayAttendances: {
      total: number;
      present: number;
      late: number;
      absent: number;
      morningCount: number;
      eveningCount: number;
    };
    attendanceRate: number | null;
  };
  items: {
    total: number;
    lost: number;
    found: number;
    pending: number;
    claimRequested: number;
    returned: number;
  };
  labs: {
    laboratoriesCount: number;
    rowsCount: number;
    machines: {
      total: number;
      functional: number;
      toCheck: number;
      defective: number;
      maintenance: number;
      outOfService: number;
      availabilityRate: number;
    };
    activeInterventions: number;
    criticalInterventions: number;
  };
  serverTime: string;
}
