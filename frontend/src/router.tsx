import { ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { Loading } from './components/ui';
import { AttendancePage } from './features/attendance/AttendancePage';
import { ScanPage } from './features/attendance/ScanPage';
import { AuditPage } from './features/admin/AuditPage';
import { ReferencePage } from './features/admin/ReferencePage';
import { SchedulesPage } from './features/admin/SchedulesPage';
import { UsersPage } from './features/admin/UsersPage';
import { ChangePasswordPage } from './features/auth/ChangePasswordPage';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/reports/DashboardPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { MySpacePage } from './features/student/MySpacePage';
import { ImportPage } from './features/students/ImportPage';
import { StudentDetailPage } from './features/students/StudentDetailPage';
import { StudentFormPage } from './features/students/StudentFormPage';
import { StudentsPage } from './features/students/StudentsPage';
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

function Home() {
  const { state } = useAuth();
  return state.status === 'authenticated' ? <Navigate to={homeFor(state.user.role)} replace /> : null;
}

const r = (roles: Role[], element: ReactNode) => <RequireRole roles={roles}>{element}</RequireRole>;

export const router = createBrowserRouter([
  { path: '/connexion', element: <LoginPage /> },
  { path: '/changer-mot-de-passe', element: <ChangePasswordPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Home /> },
          { path: 'tableau-de-bord', element: r(['ADMIN', 'SUPERVISOR'], <DashboardPage />) },
          { path: 'pointage', element: r(['ADMIN', 'SCAN_AGENT'], <ScanPage />) },
          { path: 'presences', element: r(['ADMIN', 'SUPERVISOR'], <AttendancePage />) },
          { path: 'etudiants', element: r(['ADMIN', 'SUPERVISOR'], <StudentsPage />) },
          { path: 'etudiants/nouveau', element: r(['ADMIN'], <StudentFormPage />) },
          { path: 'etudiants/:id', element: r(['ADMIN', 'SUPERVISOR'], <StudentDetailPage />) },
          { path: 'etudiants/:id/modifier', element: r(['ADMIN'], <StudentFormPage />) },
          { path: 'import', element: r(['ADMIN'], <ImportPage />) },
          { path: 'rapports', element: r(['ADMIN', 'SUPERVISOR'], <ReportsPage />) },
          { path: 'horaires', element: r(['ADMIN'], <SchedulesPage />) },
          { path: 'referentiel', element: r(['ADMIN'], <ReferencePage />) },
          { path: 'comptes', element: r(['ADMIN'], <UsersPage />) },
          { path: 'journal', element: r(['ADMIN'], <AuditPage />) },
          { path: 'systeme', element: r(['ADMIN'], <StatusPage />) },
          { path: 'mon-espace', element: r(['STUDENT'], <MySpacePage />) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
