import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { UPLLogo } from './UPLLogo';

/**
 * En-tête des pages publiques (catalogue des objets, fiche d'un objet) : même bandeau que la page
 * d'accueil. Sur téléphone, le sous-titre est masqué et les actions passent sous le logo si nécessaire.
 */
export function PublicHeader({ subtitle, children }: { subtitle?: string; children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <UPLLogo heightClass="h-10" priority />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-semibold tracking-tight text-slate-900">UPL StageTrack</span>
            {subtitle && <span className="hidden truncate text-xs text-slate-500 sm:block">{subtitle}</span>}
          </span>
        </Link>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
