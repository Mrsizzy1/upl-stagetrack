import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, Link } from 'react-router';
import { useAuth, useUser } from '../lib/auth';
import { ROLE_LABELS } from '../lib/format';
import type { Role } from '../lib/types';
import { UNIVERSITY_NAME, UPLLogo } from './UPLLogo';
import {
  HomeIcon,
  BarChartIcon,
  CheckSquareIcon,
  QrCodeIcon,
  UsersIcon,
  FileTextIcon,
  SearchIcon,
  ShieldCheckIcon,
  MonitorIcon,
  WrenchIcon,
  SmartphoneIcon,
  UserIcon,
  SettingsIcon,
  LogOutIcon,
  ClockIcon,
  DownloadIcon,
  BuildingIcon,
} from './Icons';

export interface NavItem {
  to: string;
  label: string;
  roles: Role[];
  icon: (props: { size?: number; className?: string }) => ReactNode;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const ADMIN_ROLES: Role[] = ['ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN'];
const STAGES_ROLES: Role[] = ['ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN', 'SUPERVISOR', 'INTERNSHIP_MANAGER'];
const SCAN_ROLES: Role[] = ['ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN', 'SCAN_AGENT'];
const LAB_ROLES: Role[] = ['ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN', 'IT_TECHNICIAN'];
const TECH_ROLES: Role[] = ['IT_TECHNICIAN', 'ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN'];

/** Navigation institutionnelle officielle UPL */
export const NAV_SECTIONS: NavSection[] = [
  {
    section: 'Accueil',
    items: [
      {
        to: '/hub',
        label: 'Vue d’ensemble',
        roles: ['ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN', 'SUPERVISOR', 'INTERNSHIP_MANAGER', 'IT_TECHNICIAN'],
        icon: HomeIcon,
      },
    ],
  },
  {
    section: 'Gestion des Stages',
    items: [
      { to: '/tableau-de-bord', label: 'Tableau de bord', roles: STAGES_ROLES, icon: BarChartIcon },
      { to: '/presences', label: 'Suivi des présences', roles: STAGES_ROLES, icon: CheckSquareIcon },
      { to: '/pointage', label: 'Pointage par QR Code', roles: SCAN_ROLES, icon: QrCodeIcon },
      { to: '/etudiants', label: 'Gestion des étudiants', roles: STAGES_ROLES, icon: UsersIcon },
      { to: '/import', label: 'Import des promotions', roles: ADMIN_ROLES, icon: DownloadIcon },
      { to: '/rapports', label: 'Rapports & Absences', roles: STAGES_ROLES, icon: FileTextIcon },
      { to: '/horaires', label: 'Horaires officiels', roles: ADMIN_ROLES, icon: ClockIcon },
      { to: '/referentiel', label: 'Référentiel académique', roles: ADMIN_ROLES, icon: BuildingIcon },
    ],
  },
  {
    section: 'Objets Perdus & Trouvés',
    items: [
      {
        to: '/objets',
        label: 'Catalogue des objets',
        roles: ['ADMIN', 'FACULTY_ADMIN', 'SUPER_ADMIN', 'INTERNSHIP_MANAGER', 'SUPERVISOR', 'IT_TECHNICIAN', 'SCAN_AGENT', 'INTERN', 'STUDENT'],
        icon: SearchIcon,
      },
      {
        to: '/admin/objets',
        label: 'Modération & Restitutions',
        roles: ADMIN_ROLES,
        icon: ShieldCheckIcon,
      },
    ],
  },
  {
    section: 'Parc & Salles de TP',
    items: [
      {
        to: '/parc/laboratoires',
        label: 'Salles & Laboratoires',
        roles: LAB_ROLES,
        icon: MonitorIcon,
      },
      {
        to: '/parc/interventions',
        label: 'Pannes & Maintenance',
        roles: LAB_ROLES,
        icon: WrenchIcon,
      },
      {
        to: '/parc/technicien',
        label: 'Contrôle technique',
        roles: TECH_ROLES,
        icon: SmartphoneIcon,
      },
    ],
  },
  {
    section: 'Espace Personnel',
    items: [
      { to: '/mon-espace', label: 'Mon profil & QR Code', roles: ['STUDENT', 'INTERN'], icon: UserIcon },
    ],
  },
  {
    section: 'Administration',
    items: [
      { to: '/comptes', label: 'Comptes utilisateurs', roles: ADMIN_ROLES, icon: UsersIcon },
      { to: '/supervision', label: 'Paramètres institutionnels', roles: ADMIN_ROLES, icon: SettingsIcon },
      { to: '/journal', label: 'Journal d’audit', roles: ADMIN_ROLES, icon: FileTextIcon },
      { to: '/systeme', label: 'État du système', roles: ADMIN_ROLES, icon: MonitorIcon },
    ],
  },
];

export const NAV: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

function PrintHeader() {
  return (
    <div className="hidden print:block mb-6 border-b pb-4">
      <div className="flex items-center gap-3">
        <UPLLogo size="sm" />
        <div>
          <h1 className="text-base font-bold text-slate-900">{UNIVERSITY_NAME}</h1>
          <p className="text-xs text-slate-500">Plateforme de Gestion Universitaire — Document Officiel</p>
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const user = useUser();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  const brand = (
    <div className="border-b border-white/10 px-6 py-5">
      <Link to="/hub" className="flex items-center gap-3">
        <UPLLogo size="md" decorative priority />
        <div className="leading-tight">
          <p className="text-base font-bold text-white tracking-tight">Portail Universitaire</p>
          <p className="text-xs text-upl-blue-200">{UNIVERSITY_NAME}</p>
        </div>
      </Link>
    </div>
  );

  const nav = (
    <nav aria-label="Navigation principale" className="flex flex-col gap-5 px-3 py-4">
      {NAV_SECTIONS.map((section) => {
        const visibleItems = section.items.filter((item) => item.roles.includes(user.role));
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.section}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-upl-blue-300">
              {section.section}
            </p>
            <div className="flex flex-col gap-0.5">
              {visibleItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
                        ? 'bg-white/15 text-white font-semibold'
                        : 'text-upl-blue-100 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <IconComponent size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  const account = (
    <div className="border-t border-white/10 p-4 bg-upl-blue-950/50">
      <div className="flex items-center justify-between">
        <div className="min-w-0 pr-2">
          <p className="text-sm font-semibold text-white truncate">{user.fullName}</p>
          <p className="text-xs text-upl-blue-200">{ROLE_LABELS[user.role]}</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-upl-gold-500 hover:text-upl-gold-400 shrink-0"
          title="Se déconnecter de la session"
        >
          <LogOutIcon size={14} />
          <span>Quitter</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64 flex flex-col bg-slate-50">
      {/* Barre latérale desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-upl-blue-900 lg:flex z-30 shadow-md">
        {brand}
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {account}
      </aside>

      {/* Barre supérieure mobile */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-upl-blue-800 bg-upl-blue-900 px-4 lg:hidden">
        <Link to="/hub" className="flex items-center gap-2.5">
          <UPLLogo size="sm" decorative priority />
          <span className="font-bold text-white text-sm">Portail UPL</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20"
        >
          Menu
        </button>
      </header>

      {/* Tiroir mobile */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-upl-blue-900 shadow-xl">
            {brand}
            <div className="flex-1 overflow-y-auto">{nav}</div>
            {account}
          </div>
        </div>
      )}

      {/* Barre supérieure desktop : institutionnelle et sobre */}
      <header className="hidden lg:flex sticky top-0 z-20 h-14 bg-white border-b border-slate-200 px-8 items-center justify-between shadow-xs">
        <Link
          to="/hub"
          className="text-xs font-semibold text-slate-600 hover:text-upl-blue-700 inline-flex items-center gap-2"
        >
          <HomeIcon size={16} />
          <span>Accueil du portail</span>
        </Link>
        <div className="flex items-center gap-4 text-xs">
          <span className="font-medium text-slate-700">{user.fullName}</span>
          <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-semibold border border-slate-200">
            {ROLE_LABELS[user.role]}
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-red-700 font-medium ml-1 transition-colors"
          >
            <LogOutIcon size={14} />
            <span>Déconnexion</span>
          </button>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 w-full">
        <PrintHeader />
        <Outlet />
      </main>
    </div>
  );
}
