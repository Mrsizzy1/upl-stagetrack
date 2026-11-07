import type { ReactNode } from 'react';
import { UNIVERSITY_NAME, UPLLogo } from './UPLLogo';

/*
 * Écrans hors application (connexion, changement de mot de passe) : une carte compacte, centrée,
 * qui tient sans défilement du téléphone (360 × 640) à l'ordinateur.
 *  - short: (hauteur ≤ 620 px, petite tablette en paysage) : logo réduit, mentions secondaires masquées ;
 *  - tiny: (hauteur ≤ 480 px, téléphone à l'horizontale) : logo à côté du nom, marges minimales.
 * Variantes déclarées dans index.css. Les classes restent écrites en toutes lettres (Tailwind ne
 * détecte pas les noms construits dynamiquement) ; le suffixe « ! » prime sur les variantes sm:.
 */

/** En-tête institutionnel : logo, université, nom du système. */
export function AuthBrand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex flex-col items-center text-center tiny:flex-row! tiny:justify-center tiny:gap-3 tiny:text-left!">
      <UPLLogo heightClass="h-16 sm:h-[4.5rem] short:h-12! tiny:h-10!" priority />
      <div className="flex flex-col items-center tiny:items-start!">
        <p className="mt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-upl-blue-700 short:mt-1.5! tiny:mt-0!">
          {UNIVERSITY_NAME}
        </p>
        <p className="text-lg font-bold leading-tight tracking-tight text-upl-blue-950">UPL StageTrack</p>
        {subtitle && <p className="text-xs text-upl-blue-800 short:hidden">{subtitle}</p>}
        <span aria-hidden className="mt-3 h-0.5 w-10 rounded-full bg-upl-gold-500 short:mt-2! tiny:hidden" />
      </div>
    </div>
  );
}

/** Cadre : fond bleu UPL, carte blanche centrée (le logo est conçu pour un fond blanc). */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-upl-blue-900">
      <span aria-hidden className="h-1 w-full shrink-0 bg-upl-gold-500" />
      <main className="flex flex-1 items-center justify-center px-4 py-6 short:py-3! tiny:py-2!">
        <div className="w-full max-w-[22rem] rounded-xl bg-white px-6 py-6 shadow-xl shadow-upl-blue-950/40 sm:px-7 short:py-4! tiny:max-w-[26rem]! tiny:py-3!">
          {children}
        </div>
      </main>
      <footer className="shrink-0 px-4 pb-3 text-center text-[11px] text-upl-blue-100/80 short:hidden">
        {UNIVERSITY_NAME} · Suivi des présences des stagiaires
      </footer>
    </div>
  );
}

/** Champs et bouton compacts des écrans d'authentification (priment sur les tailles par défaut). */
export const AUTH_INPUT = 'py-1.5!';
export const AUTH_BUTTON = 'w-full py-2!';
/** Formulaire : espacements réduits, encore resserrés sur les écrans très bas. */
export const AUTH_FORM = 'mt-5 space-y-3 short:mt-3! tiny:mt-2! tiny:space-y-2!';
/** Mentions secondaires masquées sur les écrans très bas. */
export const AUTH_SECONDARY = 'tiny:hidden';
