import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router';
import { useAuth, useUser } from '../lib/auth';
import { formatLongDate, ROLE_LABELS, todayInLubumbashi } from '../lib/format';
import type { Role } from '../lib/types';
import { Loading } from './ui';
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
  MenuIcon,
  XIcon,
  ChevronRightIcon,
  CalendarIcon,
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
    <div className="mb-6 hidden border-b border-slate-300 pb-4 print:block">
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

/** Initiales pour la pastille du compte : « Administrateur StageTrack » → « AS ». */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0][0], parts[parts.length - 1][0]] : [parts[0]?.[0] ?? '?'];
  return letters.join('').toUpperCase();
}

/** Section et page courantes, déduites de la navigation (correspondance la plus longue). */
function useCurrentNav(): { section: string; label: string } | null {
  const { pathname } = useLocation();
  let best: { section: string; label: string; length: number } | null = null;
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      const match = pathname === item.to || pathname.startsWith(`${item.to}/`);
      if (match && (!best || item.to.length > best.length)) best = { section: section.section, label: item.label, length: item.to.length };
    }
  }
  return best;
}

export function AppLayout() {
  const user = useUser();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const current = useCurrentNav();
  const today = formatLongDate(todayInLubumbashi());

  // Tiroir mobile : fermeture par Échap, page figée derrière.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const brand = (
    <Link to="/hub" onClick={() => setOpen(false)} className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5 focus-visible:outline-white">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
        <UPLLogo heightClass="h-9" decorative priority />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[15px] font-semibold tracking-tight text-white">UPL StageTrack</span>
        <span className="block truncate text-[11px] font-medium text-upl-blue-300">Portail universitaire</span>
      </span>
    </Link>
  );

  const nav = (
    <nav aria-label="Navigation principale" className="flex flex-col gap-6 px-3 py-5">
      {NAV_SECTIONS.map((section) => {
        const visibleItems = section.items.filter((item) => item.roles.includes(user.role));
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.section}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-upl-blue-300/80">{section.section}</p>
            <div className="flex flex-col gap-0.5">
              {visibleItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors focus-visible:outline-white ${
                        isActive
                          ? 'bg-white/10 font-semibold text-white before:absolute before:inset-y-1.5 before:-left-3 before:w-1 before:rounded-r-full before:bg-upl-gold-500'
                          : 'font-medium text-upl-blue-100/80 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <IconComponent size={18} className={isActive ? 'shrink-0 text-upl-gold-400' : 'shrink-0 text-upl-blue-300 group-hover:text-white'} />
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
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
    <div className="shrink-0 border-t border-white/10 p-3">
      <div className="flex items-center gap-3 rounded-lg bg-white/5 p-2.5">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-upl-gold-500 text-xs font-bold text-upl-blue-950">
          {initials(user.fullName)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-semibold text-white" title={user.fullName}>
            {user.fullName}
          </p>
          <p className="truncate text-[11px] text-upl-blue-300">{ROLE_LABELS[user.role]}</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="shrink-0 rounded-md p-2 text-upl-blue-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-white"
          title="Se déconnecter"
          aria-label="Se déconnecter"
        >
          <LogOutIcon size={17} />
        </button>
      </div>
    </div>
  );

  const sidebarSurface = 'bg-upl-blue-950 bg-linear-to-b from-upl-blue-900 to-upl-blue-950';

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 lg:pl-64">
      {/* Barre latérale (ordinateur) */}
      <aside className={`no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col lg:flex ${sidebarSurface}`}>
        {brand}
        <div className="nav-scroll flex-1 overflow-y-auto">{nav}</div>
        {account}
      </aside>

      {/* Barre supérieure (mobile) */}
      <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        <Link to="/hub" className="flex min-w-0 items-center gap-2.5">
          <UPLLogo heightClass="h-8" decorative priority />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold text-slate-900">UPL StageTrack</span>
            {current && <span className="block truncate text-[11px] text-slate-500">{current.label}</span>}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={open}
          className="-mr-1 rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <MenuIcon size={22} />
        </button>
      </header>

      {/* Tiroir (mobile) */}
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-upl-blue-950/60 backdrop-blur-[2px]" aria-label="Fermer le menu" onClick={() => setOpen(false)} />
          <div className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col shadow-xl ${sidebarSurface}`}>
            <div className="relative">
              {brand}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-upl-blue-200 hover:bg-white/10 hover:text-white focus-visible:outline-white"
              >
                <XIcon size={18} />
              </button>
            </div>
            <div className="nav-scroll flex-1 overflow-y-auto">{nav}</div>
            {account}
          </div>
        </div>
      )}

      {/* Barre supérieure (ordinateur) : fil d'Ariane, date de référence, rôle */}
      <header className="no-print sticky top-0 z-20 hidden h-16 items-center justify-between gap-6 border-b border-slate-200 bg-white/90 px-8 backdrop-blur lg:flex">
        <nav aria-label="Fil d'Ariane" className="flex min-w-0 items-center gap-2 text-sm">
          <Link to="/hub" className="rounded-md p-1 text-slate-400 transition-colors hover:text-upl-blue-700" aria-label="Accueil du portail" title="Accueil du portail">
            <HomeIcon size={16} />
          </Link>
          {current && (
            <>
              <ChevronRightIcon size={14} className="shrink-0 text-slate-300" />
              <span className="truncate text-slate-500">{current.section}</span>
              <ChevronRightIcon size={14} className="shrink-0 text-slate-300" />
              <span className="truncate font-semibold text-slate-900">{current.label}</span>
            </>
          )}
        </nav>
        <div className="flex shrink-0 items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-2 text-slate-500" title="Date à Lubumbashi">
            <CalendarIcon size={15} className="text-slate-400" />
            <span className="first-letter:uppercase">{today}</span>
          </span>
          <span aria-hidden className="h-5 w-px bg-slate-200" />
          <span className="inline-flex items-center rounded-full bg-upl-blue-50 px-2.5 py-1 font-semibold text-upl-blue-800 ring-1 ring-inset ring-upl-blue-200">
            {ROLE_LABELS[user.role]}
          </span>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="mx-auto w-full max-w-[84rem] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <PrintHeader />
        <Suspense fallback={<Loading />}>
          <div className="animate-enter">
            <Outlet />
          </div>
        </Suspense>
      </main>
    </div>
  );
}
