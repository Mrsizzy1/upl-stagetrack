import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useAuth, useUser } from '../lib/auth';
import { ROLE_LABELS } from '../lib/format';
import type { Role } from '../lib/types';
import { UNIVERSITY_NAME, UPLLogo } from './UPLLogo';

interface NavItem {
  to: string;
  label: string;
  roles: Role[];
}

/** Menu par rôle : chaque entrée correspond à une page réellement fonctionnelle. */
export const NAV: NavItem[] = [
  { to: '/tableau-de-bord', label: 'Tableau de bord', roles: ['ADMIN', 'SUPERVISOR'] },
  { to: '/pointage', label: 'Pointage', roles: ['ADMIN', 'SCAN_AGENT'] },
  { to: '/presences', label: 'Présences', roles: ['ADMIN', 'SUPERVISOR'] },
  { to: '/etudiants', label: 'Étudiants', roles: ['ADMIN', 'SUPERVISOR'] },
  { to: '/import', label: 'Import', roles: ['ADMIN'] },
  { to: '/rapports', label: 'Rapports', roles: ['ADMIN', 'SUPERVISOR'] },
  { to: '/horaires', label: 'Horaires', roles: ['ADMIN'] },
  { to: '/referentiel', label: 'Référentiel', roles: ['ADMIN'] },
  { to: '/comptes', label: 'Comptes', roles: ['ADMIN'] },
  { to: '/journal', label: "Journal d'audit", roles: ['ADMIN'] },
  { to: '/systeme', label: 'État du système', roles: ['ADMIN'] },
  { to: '/mon-espace', label: 'Mon espace', roles: ['STUDENT'] },
];

export function AppLayout() {
  const user = useUser();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => n.roles.includes(user.role));

  const nav = (
    <nav aria-label="Navigation principale" className="flex flex-col gap-0.5 px-3">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? 'bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-upl-gold-500)]' : 'text-upl-blue-100 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  const brand = (
    <div className="border-b border-white/10 px-5 pb-5 pt-6">
      <div className="flex items-center gap-3">
        <UPLLogo size="md" decorative priority />
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-wide text-white">UPL StageTrack</p>
          <p className="mt-0.5 text-xs text-upl-blue-100">{UNIVERSITY_NAME}</p>
        </div>
      </div>
    </div>
  );

  const account = (
    <div className="border-t border-white/10 px-6 py-4 text-sm">
      <p className="font-medium text-white">{user.fullName}</p>
      <p className="text-xs text-upl-blue-100">{ROLE_LABELS[user.role]}</p>
      <button type="button" onClick={() => void logout()} className="mt-3 text-xs font-semibold text-upl-gold-500 hover:underline">
        Se déconnecter
      </button>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64 print:pl-0">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-upl-blue-900 lg:flex print:hidden">
        {brand}
        <div className="flex-1 overflow-y-auto pt-3">{nav}</div>
        {account}
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b-2 border-upl-gold-500 bg-upl-blue-900 px-4 lg:hidden print:hidden">
        <span className="flex min-w-0 items-center gap-2.5">
          <UPLLogo size="sm" decorative priority />
          <span className="min-w-0 leading-tight">
            <span className="block font-semibold text-white">UPL StageTrack</span>
            <span className="block truncate text-[11px] text-upl-blue-100">{UNIVERSITY_NAME}</span>
          </span>
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/30"
          aria-expanded={open}
        >
          Menu
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden print:hidden">
          <button type="button" className="absolute inset-0 bg-upl-blue-950/50" aria-label="Fermer le menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-upl-blue-900">
            {brand}
            <div className="flex-1 overflow-y-auto pt-3">{nav}</div>
            {account}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:px-0 print:py-0">
        <PrintHeader />
        <Outlet />
      </main>
    </div>
  );
}

/** En-tête institutionnel imprimé en haut de chaque page (Ctrl+P sur un rapport, une liste…). Invisible à l'écran. */
function PrintHeader() {
  const printedAt = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
  return (
    <div className="mb-6 hidden items-center gap-4 border-b-2 border-upl-blue-700 pb-3 print:flex">
      <UPLLogo size="md" decorative priority />
      <div className="flex-1 leading-tight">
        <p className="text-base font-bold uppercase tracking-wide text-upl-blue-700">{UNIVERSITY_NAME}</p>
        <p className="text-sm font-semibold text-upl-blue-950">UPL StageTrack — Gestion des présences des stagiaires</p>
      </div>
      <p className="text-xs text-upl-blue-800">Imprimé le {printedAt}</p>
    </div>
  );
}
