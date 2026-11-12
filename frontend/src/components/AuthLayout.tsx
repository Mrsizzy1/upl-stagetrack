import type { ReactNode } from 'react';
import { CheckSquareIcon, MonitorIcon, QrCodeIcon, SearchIcon } from './Icons';
import { UNIVERSITY_NAME, UPLLogo } from './UPLLogo';

/*
 * Écrans hors application (connexion, changement de mot de passe).
 *  - ordinateur (lg) : deux volets — présentation institutionnelle à gauche, formulaire à droite ;
 *  - téléphone et tablette : une carte compacte, centrée, qui tient sans défilement dès 360 × 640.
 *  - short: (hauteur ≤ 620 px, petite tablette en paysage) : logo réduit, mentions secondaires masquées ;
 *  - tiny: (hauteur ≤ 480 px, téléphone à l'horizontale) : logo à côté du nom, marges minimales.
 * Variantes déclarées dans index.css. Les classes restent écrites en toutes lettres (Tailwind ne
 * détecte pas les noms construits dynamiquement) ; le suffixe « ! » prime sur les variantes sm:.
 */

/** En-tête institutionnel de la carte : logo, université, nom du système. Masqué quand le volet de gauche est affiché. */
export function AuthBrand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex flex-col items-center text-center lg:hidden tiny:flex-row! tiny:justify-center tiny:gap-3 tiny:text-left!">
      <UPLLogo heightClass="h-16 sm:h-[4.5rem] short:h-12! tiny:h-10!" priority />
      <div className="flex flex-col items-center tiny:items-start!">
        <p className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-upl-blue-700 short:mt-1.5! tiny:mt-0!">{UNIVERSITY_NAME}</p>
        <p className="text-lg font-semibold leading-tight tracking-tight text-slate-900">UPL StageTrack</p>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 short:hidden">{subtitle}</p>}
      </div>
    </div>
  );
}

const HIGHLIGHTS = [
  { icon: QrCodeIcon, title: 'Pointage par QR Code', text: "Présences des stagiaires enregistrées à l'heure du serveur." },
  { icon: CheckSquareIcon, title: 'Suivi et rapports', text: 'Absences, retards et exports Excel ou PDF par période.' },
  { icon: SearchIcon, title: 'Objets perdus et trouvés', text: 'Déclarations publiques, modération et restitutions.' },
  { icon: MonitorIcon, title: 'Parc informatique', text: 'Salles de TP, état des machines et interventions.' },
];

/** Volet institutionnel (ordinateur uniquement). */
function AuthAside() {
  return (
    <aside className="relative hidden overflow-hidden bg-upl-blue-950 bg-linear-to-br from-upl-blue-900 via-upl-blue-950 to-upl-blue-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-upl-gold-500" />
      <span aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full border border-white/5" />
      <span aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-[22rem] w-[22rem] rounded-full border border-white/5" />

      <div className="relative flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white shadow-lg">
          <UPLLogo heightClass="h-[3.25rem]" priority />
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-upl-gold-400">{UNIVERSITY_NAME}</p>
          <p className="text-lg font-semibold tracking-tight">UPL StageTrack</p>
        </div>
      </div>

      <div className="relative max-w-md py-10 short:py-4">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">Le portail numérique de la faculté</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-upl-blue-200">
          Un accès unique aux services universitaires : stages, présences, objets trouvés et salles informatiques.
        </p>
        <ul className="mt-10 space-y-5 short:hidden">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-upl-gold-400 ring-1 ring-inset ring-white/10">
                <Icon size={19} />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-[13px] leading-snug text-upl-blue-200">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-upl-blue-300">
        © {new Date().getFullYear()} {UNIVERSITY_NAME}
      </p>
    </aside>
  );
}

/** Cadre : volet institutionnel + carte blanche centrée (le logo est conçu pour un fond blanc). */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-slate-50 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <AuthAside />
      <div className="flex min-h-dvh flex-col lg:min-h-0">
        <span aria-hidden className="h-1 w-full shrink-0 bg-upl-blue-700 lg:hidden" />
        <main className="flex flex-1 items-center justify-center px-4 py-6 short:py-3! tiny:py-2!">
          <div className="w-full max-w-[23rem] rounded-2xl bg-white px-6 py-7 shadow-lg ring-1 ring-slate-200 sm:px-8 sm:py-8 short:py-4! tiny:max-w-[26rem]! tiny:py-3!">
            {children}
          </div>
        </main>
        <footer className="shrink-0 px-4 pb-4 text-center text-[11px] text-slate-500 short:hidden">
          {UNIVERSITY_NAME} · Plateforme de gestion universitaire
        </footer>
      </div>
    </div>
  );
}

/** Champs et bouton des écrans d'authentification (priment sur les tailles par défaut). */
export const AUTH_INPUT = 'py-2! short:py-1.5!';
export const AUTH_BUTTON = 'w-full py-2.5! short:py-2!';
/** Formulaire : espacements réduits sur les écrans très bas ; pas de marge haute quand l'en-tête de carte est masqué (lg). */
export const AUTH_FORM = 'mt-6 space-y-4 lg:mt-0 short:mt-3! short:space-y-3! tiny:mt-2! tiny:space-y-2!';
/** Mentions secondaires masquées sur les écrans très bas. */
export const AUTH_SECONDARY = 'tiny:hidden';
