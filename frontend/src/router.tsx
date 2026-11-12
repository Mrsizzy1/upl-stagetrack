import { lazy, ReactNode, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { RootErrorBoundary } from './components/RootErrorBoundary';
import { Loading } from './components/ui';
import { LoginPage } from './features/auth/LoginPage';
import { HomePage } from './features/home/HomePage';
import { useAuth } from './lib/auth';
import { homeFor } from './lib/routes';
import type { Role } from './lib/types';

// Pages chargées à la demande : le lot initial ne contient que l'accueil et la connexion.
const AttendancePage = lazy(() => import('./features/attendance/AttendancePage').then((m) => ({ default: m.AttendancePage })));
const ScanPage = lazy(() => import('./features/attendance/ScanPage').then((m) => ({ default: m.ScanPage })));
const AuditPage = lazy(() => import('./features/admin/AuditPage').then((m) => ({ default: m.AuditPage })));
const ReferencePage = lazy(() => import('./features/admin/ReferencePage').then((m) => ({ default: m.ReferencePage })));
const SchedulesPage = lazy(() => import('./features/admin/SchedulesPage').then((m) => ({ default: m.SchedulesPage })));
const UsersPage = lazy(() => import('./features/admin/UsersPage').then((m) => ({ default: m.UsersPage })));
const ChangePasswordPage = lazy(() => import('./features/auth/ChangePasswordPage').then((m) => ({ default: m.ChangePasswordPage })));
const PortalHubPage = lazy(() => import('./features/home/PortalHubPage').then((m) => ({ default: m.PortalHubPage })));
const AdminItemsPage = lazy(() => import('./features/items/AdminItemsPage').then((m) => ({ default: m.AdminItemsPage })));
const ItemDetailPage = lazy(() => import('./features/items/ItemDetailPage').then((m) => ({ default: m.ItemDetailPage })));
const ItemsPublicPage = lazy(() => import('./features/items/ItemsPublicPage').then((m) => ({ default: m.ItemsPublicPage })));
const LabDetailPage = lazy(() => import('./features/labs/LabDetailPage').then((m) => ({ default: m.LabDetailPage })));
const LabsPage = lazy(() => import('./features/labs/LabsPage').then((m) => ({ default: m.LabsPage })));
const InterventionsPage = lazy(() => import('./features/machines/InterventionsPage').then((m) => ({ default: m.InterventionsPage })));
const PublicMachinePage = lazy(() => import('./features/machines/PublicMachinePage').then((m) => ({ default: m.PublicMachinePage })));
const TechnicianScanPage = lazy(() => import('./features/machines/TechnicianScanPage').then((m) => ({ default: m.TechnicianScanPage })));
const DashboardPage = lazy(() => import('./features/reports/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ReportsPage = lazy(() => import('./features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const MySpacePage = lazy(() => import('./features/student/MySpacePage').then((m) => ({ default: m.MySpacePage })));
const ImportPage = lazy(() => import('./features/students/ImportPage').then((m) => ({ default: m.ImportPage })));
const StudentDetailPage = lazy(() => import('./features/students/StudentDetailPage').then((m) => ({ default: m.StudentDetailPage })));
const StudentFormPage = lazy(() => import('./features/students/StudentFormPage').then((m) => ({ default: m.StudentFormPage })));
const StudentsPage = lazy(() => import('./features/students/StudentsPage').then((m) => ({ default: m.StudentsPage })));
const SupervisionPage = lazy(() => import('./features/supervision/SupervisionPage').then((m) => ({ default: m.SupervisionPage })));
const NotFoundPage = lazy(() => import('./features/system/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const StatusPage = lazy(() => import('./features/system/StatusPage').then((m) => ({ default: m.StatusPage })));

/** Attente pendant le chargement d'une page publique (les pages internes attendent dans AppLayout). */
const page = (element: ReactNode) => <Suspense fallback={<Loading label="Chargement…" />}>{element}</Suspense>;

/** Accès réservé aux utilisateurs connectés ; mot de passe provisoire → changement obligatoire. */
function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <Loading label="Ouverture de la session…" />;
  if (state.status === 'anonymous') return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  if (state.user.mustChangePassword) return <Navigate to="/changer-mot-de-passe" replace />;
  return <Outlet />;
}

/** Contrôle d'interface seulement : l'API applique la même règle de son côté. */
function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  if (!roles.includes(state.user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/**
 * Route index "/" : publique si non connecté (HomePage), sinon redirige vers l'espace
 * correspondant au rôle de l'utilisateur.
 */
function HomeOrRedirect() {
  const { state } = useAuth();
  if (state.status === 'loading') return <Loading label="Chargement…" />;
  if (state.status === 'authenticated') return <Navigate to={homeFor(state.user.role)} replace />;
  return <HomePage />;
}

const r = (roles: Role[], element: ReactNode) => <RequireRole roles={roles}>{element}</RequireRole>;

const ADMIN_ROLES: Role[] = ['ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN'];
const STAGES_ROLES: Role[] = ['ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN', 'SUPERVISOR', 'INTERNSHIP_MANAGER'];
const SCAN_ROLES: Role[] = ['ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN', 'SCAN_AGENT'];
const LAB_ROLES: Role[] = ['ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN', 'IT_TECHNICIAN'];
const TECH_ROLES: Role[] = ['IT_TECHNICIAN', 'ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN'];
const HUB_ROLES: Role[] = ['SUPER_ADMIN', 'FACULTY_ADMIN', 'ADMIN', 'INTERNSHIP_MANAGER', 'SUPERVISOR', 'IT_TECHNICIAN'];

export const router = createBrowserRouter([
  // ── Routes publiques (sans AppLayout) ──────────────────────────────────────
  { path: '/', element: <HomeOrRedirect />, errorElement: <RootErrorBoundary /> },
  { path: '/connexion', element: <LoginPage />, errorElement: <RootErrorBoundary /> },
  { path: '/changer-mot-de-passe', element: page(<ChangePasswordPage />), errorElement: <RootErrorBoundary /> },

  // ── Vue publique machine (QR Code scanné par n'importe quel appareil) ──────
  { path: '/m/:token', element: page(<PublicMachinePage />), errorElement: <RootErrorBoundary /> },
  { path: '/public/machines/:token', element: page(<PublicMachinePage />), errorElement: <RootErrorBoundary /> },

  // ── Catalogue public des objets perdus (lecture sans compte) ───────────────
  { path: '/objets', element: page(<ItemsPublicPage />), errorElement: <RootErrorBoundary /> },
  { path: '/objets/:id', element: page(<ItemDetailPage />), errorElement: <RootErrorBoundary /> },

  // ── Application authentifiée ───────────────────────────────────────────────
  {
    element: <RequireAuth />,
    errorElement: <RootErrorBoundary />,
    children: [
      {
        element: <AppLayout />,
        children: [
          // Hub unifié des services
          {
            path: 'hub',
            element: r(HUB_ROLES, <PortalHubPage />),
          },

          // Supervision centrale
          {
            path: 'supervision',
            element: r(ADMIN_ROLES, <SupervisionPage />),
          },

          // Stages & Présences
          { path: 'tableau-de-bord', element: r(STAGES_ROLES, <DashboardPage />) },
          { path: 'pointage', element: r(SCAN_ROLES, <ScanPage />) },
          { path: 'presences', element: r(STAGES_ROLES, <AttendancePage />) },
          { path: 'etudiants', element: r(STAGES_ROLES, <StudentsPage />) },
          { path: 'etudiants/nouveau', element: r(ADMIN_ROLES, <StudentFormPage />) },
          { path: 'etudiants/:id', element: r(STAGES_ROLES, <StudentDetailPage />) },
          { path: 'etudiants/:id/modifier', element: r(ADMIN_ROLES, <StudentFormPage />) },
          { path: 'import', element: r(ADMIN_ROLES, <ImportPage />) },
          { path: 'rapports', element: r(STAGES_ROLES, <ReportsPage />) },
          { path: 'horaires', element: r(ADMIN_ROLES, <SchedulesPage />) },
          { path: 'referentiel', element: r(ADMIN_ROLES, <ReferencePage />) },

          // Objets perdus (vues authentifiées)
          { path: 'admin/objets', element: r(ADMIN_ROLES, <AdminItemsPage />) },

          // Parc informatique
          {
            path: 'parc/laboratoires',
            element: r(LAB_ROLES, <LabsPage />),
          },
          {
            path: 'parc/laboratoires/:id',
            element: r(LAB_ROLES, <LabDetailPage />),
          },
          {
            path: 'parc/interventions',
            element: r(LAB_ROLES, <InterventionsPage />),
          },
          {
            path: 'parc/technicien',
            element: r(TECH_ROLES, <TechnicianScanPage />),
          },

          // Espace personnel
          { path: 'mon-espace', element: r(['STUDENT', 'INTERN'], <MySpacePage />) },

          // Administration
          { path: 'comptes', element: r(ADMIN_ROLES, <UsersPage />) },
          { path: 'journal', element: r(ADMIN_ROLES, <AuditPage />) },
          { path: 'systeme', element: r(ADMIN_ROLES, <StatusPage />) },

          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
