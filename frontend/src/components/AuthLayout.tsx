import type { ReactNode } from 'react';
import { UNIVERSITY_NAME, UPLLogo } from './UPLLogo';

/** En-tête institutionnel des écrans hors application (connexion, changement de mot de passe). */
export function AuthBrand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <UPLLogo size="lg" priority />
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-upl-blue-700">{UNIVERSITY_NAME}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-upl-blue-950">UPL StageTrack</p>
      {subtitle && <p className="mt-1 text-sm text-upl-blue-800">{subtitle}</p>}
      <span aria-hidden className="mt-4 h-1 w-12 rounded-full bg-upl-gold-500" />
    </div>
  );
}

/** Cadre : fond bleu UPL, carte blanche au centre (le logo est conçu pour un fond blanc). */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-upl-blue-900">
      <span aria-hidden className="h-1 w-full bg-upl-gold-500" />
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md rounded-xl bg-white px-6 py-8 shadow-2xl shadow-upl-blue-950/40 sm:px-10 sm:py-10">{children}</div>
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-upl-blue-100">Suivi des présences des stagiaires · {UNIVERSITY_NAME}</footer>
    </div>
  );
}
