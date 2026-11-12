import { ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { RootErrorBoundary } from './components/RootErrorBoundary';
import { Loading } from './components/ui';
import { AttendancePage } from './features/attendance/AttendancePage';
import { ScanPage } from './features/attendance/ScanPage';
import { AuditPage } from './features/admin/AuditPage';
import { ReferencePage } from './features/admin/ReferencePage';
import { SchedulesPage } from './features/admin/SchedulesPage';
import { UsersPage } from './features/admin/UsersPage';
import { ChangePasswordPage } from './features/auth/ChangePasswordPage';
import { LoginPage } from './features/auth/LoginPage';
import { HomePage } from './features/home/HomePage';
import { PortalHubPage } from './features/home/PortalHubPage';
import { AdminItemsPage } from './features/items/AdminItemsPage';
import { ItemDetailPage } from './features/items/ItemDetailPage';
import { ItemsPublicPage } from './features/items/ItemsPublicPage';
import { LabDetailPage } from './features/labs/LabDetailPage';
import { LabsPage } from './features/labs/LabsPage';
import { InterventionsPage } from './features/machines/InterventionsPage';
import { PublicMachinePage } from './features/machines/PublicMachinePage';
import { TechnicianScanPage } from './features/machines/TechnicianScanPage';
import { DashboardPage } from './features/reports/DashboardPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { MySpacePage } from './features/student/MySpacePage';
import { ImportPage } from './features/students/ImportPage';
import { StudentDetailPage } from './features/students/StudentDetailPage';
import { StudentFormPage } from './features/students/StudentFormPage';
import { StudentsPage } from './features/students/StudentsPage';
import { SupervisionPage } from './features/supervision/SupervisionPage';
import { NotFoundPage } from './features/system/NotFoundPage';
import { StatusPage } from './features/system/StatusPage';
import { useAuth } from './lib/auth';
import { homeFor } from './lib/routes';
import type { Role } from './lib/types';

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
  { path: '/changer-mot-de-passe', element: <ChangePasswordPage />, errorElement: <RootErrorBoundary /> },

  // ── Vue publique machine (QR Code scanné par n'importe quel appareil) ──────
  { path: '/m/:token', element: <PublicMachinePage />, errorElement: <RootErrorBoundary /> },
  { path: '/public/machines/:token', element: <PublicMachinePage />, errorElement: <RootErrorBoundary /> },

  // ── Catalogue public des objets perdus (lecture sans compte) ───────────────
  { path: '/objets', element: <ItemsPublicPage />, errorElement: <RootErrorBoundary /> },
  { path: '/objets/:id', element: <ItemDetailPage />, errorElement: <RootErrorBoundary /> },

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
