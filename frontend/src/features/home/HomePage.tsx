import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { UPLLogo } from '../../components/UPLLogo';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  GraduationCapIcon,
  LockIcon,
  MailIcon,
  MapPinIcon,
  MonitorIcon,
  PhoneIcon,
  QrCodeIcon,
  SearchIcon,
  ShieldCheckIcon,
  WrenchIcon,
} from '../../components/Icons';
import { buttonClass } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { homeFor } from '../../lib/routes';
import type { InstitutionSetting } from '../../lib/types';

interface Service {
  icon: (props: { size?: number; className?: string }) => ReactNode;
  title: string;
  description: string;
  points: string[];
  cta: string;
  /** Destination quand l'utilisateur est connecté ; sinon /connexion (sauf service public). */
  to: string;
  isPublic?: boolean;
}

const SERVICES: Service[] = [
  {
    icon: GraduationCapIcon,
    title: 'Gestion des stages',
    description: 'Suivi des stagiaires, des encadreurs et des présences, du pointage au rapport.',
    points: ['Pointage par QR Code, matin et soir', 'Absences et retards par période', 'Cartes étudiantes et rapports Excel / PDF'],
    cta: 'Accéder aux stages',
    to: '/tableau-de-bord',
  },
  {
    icon: SearchIcon,
    title: 'Objets perdus et trouvés',
    description: 'Catalogue public pour déclarer un objet perdu, signaler un objet trouvé ou le réclamer.',
    points: ['Consultation sans compte', 'Recherche par catégorie, date et lieu', 'Demande de restitution avec justificatif'],
    cta: 'Consulter le catalogue',
    to: '/objets',
    isPublic: true,
  },
  {
    icon: MonitorIcon,
    title: 'Parc informatique',
    description: 'Salles de travaux pratiques et postes, chacun identifié par un QR Code permanent.',
    points: ['Plan des salles et des postes', 'État de chaque machine et de ses composants', 'Fiche publique après scan en salle'],
    cta: 'Explorer le parc',
    to: '/parc/laboratoires',
  },
  {
    icon: WrenchIcon,
    title: 'Espace technicien',
    description: 'Contrôles périodiques, maintenance préventive et suivi des pannes pour les techniciens.',
    points: ['Scan mobile et contrôle par composant', 'Historique des contrôles conservé', 'Signalement et suivi des interventions'],
    cta: "Ouvrir l'espace technicien",
    to: '/parc/technicien',
  },
];

const GUARANTEES = [
  { icon: QrCodeIcon, title: 'QR Codes permanents', text: 'Un jeton opaque par étudiant et par machine, sans donnée personnelle.' },
  { icon: ShieldCheckIcon, title: 'Journal d’audit', text: 'Chaque action sensible est tracée et ne peut pas être modifiée.' },
  { icon: LockIcon, title: 'Accès par rôle', text: 'Chaque acteur ne voit que les outils liés à sa fonction.' },
];

export function HomePage() {
  const { state } = useAuth();
  const authenticated = state.status === 'authenticated';

  const { data: settings } = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => api.get<InstitutionSetting>('/settings'),
    staleTime: 60_000,
  });

  const institutionName = settings?.institutionName ?? 'Université Protestante de Lubumbashi';
  const facultyName = settings?.facultyName?.trim() ?? '';
  const acronym = settings?.acronym ?? 'UPL';
  const spaceLink = authenticated ? homeFor(state.user.role) : '/connexion';
  const hasContact = Boolean(settings?.contactEmail || settings?.contactPhone || settings?.address);

  return (
    <div className="flex min-h-dvh flex-col bg-white text-slate-800">
      {/* En-tête */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <UPLLogo heightClass="h-10" priority />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-semibold tracking-tight text-slate-900">{acronym} StageTrack</span>
              {facultyName && <span className="hidden truncate text-xs text-slate-500 sm:block">{facultyName}</span>}
            </span>
          </Link>

          <nav aria-label="Sections de la page" className="hidden items-center gap-1 text-sm font-medium text-slate-600 md:flex">
            {[
              ['#services', 'Services'],
              ['#presentation', 'Présentation'],
              ['#contact', 'Contact'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-md px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-900">
                {label}
              </a>
            ))}
          </nav>

          <Link to={spaceLink} className={buttonClass('primary')}>
            {authenticated ? 'Mon espace' : 'Connexion'}
          </Link>
        </div>
      </header>

      {/* Bandeau d'ouverture */}
      <section className="relative overflow-hidden bg-upl-blue-950 bg-linear-to-br from-upl-blue-900 via-upl-blue-950 to-upl-blue-950 text-white">
        <span aria-hidden className="pointer-events-none absolute -right-48 -top-48 h-[40rem] w-[40rem] rounded-full border border-white/5" />
        <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full border border-white/5" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:px-8 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-upl-gold-400">
              <span aria-hidden className="h-px w-8 bg-upl-gold-500" />
              {institutionName}
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Le portail numérique de la faculté</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-upl-blue-200 sm:text-lg">
              {settings?.portalSubtitle ??
                'Un accès unique aux services universitaires : suivi des stages, objets perdus et trouvés, salles et équipements informatiques.'}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={spaceLink} className={buttonClass('primary', 'lg', 'bg-upl-gold-500! text-upl-blue-950! hover:bg-upl-gold-400! focus-visible:outline-white!')}>
                {authenticated ? 'Accéder à mon espace' : 'Se connecter'}
                <ArrowRightIcon size={16} />
              </Link>
              <Link
                to="/objets"
                className={buttonClass('secondary', 'lg', 'bg-white/10! text-white! ring-white/20! hover:bg-white/15! focus-visible:outline-white!')}
              >
                Objets perdus et trouvés
              </Link>
            </div>
          </div>

          {/* Aperçu des services : accès directs, sans chiffres inventés. */}
          <ul className="hidden gap-3 lg:grid">
            {SERVICES.map(({ icon: Icon, title, description, to, isPublic }) => (
              <li key={title}>
                <Link
                  to={authenticated || isPublic ? to : '/connexion'}
                  className="group flex items-center gap-4 rounded-xl bg-white/5 p-4 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 focus-visible:outline-white"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-upl-gold-400">
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {title}
                      {isPublic && <span className="rounded-full bg-upl-gold-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-upl-gold-300">Public</span>}
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-[13px] text-upl-blue-200">{description}</span>
                  </span>
                  <ArrowRightIcon size={16} className="shrink-0 text-upl-blue-300 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="scroll-mt-16 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-upl-blue-700">Services</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Quatre services, un seul portail</h2>
            <p className="mt-3 leading-relaxed text-slate-600">
              Certains services sont ouverts à tous ; les autres demandent un compte attribué selon vos responsabilités.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {SERVICES.map(({ icon: Icon, title, description, points, cta, to, isPublic }) => (
              <article key={title} className="flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-upl-blue-50 text-upl-blue-700 ring-1 ring-inset ring-upl-blue-100">
                    <Icon size={22} />
                  </span>
                  <span
                    className={
                      isPublic
                        ? 'rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-800 ring-1 ring-inset ring-success-200'
                        : 'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200'
                    }
                  >
                    {isPublic ? (
                      'Accès public'
                    ) : (
                      <>
                        <LockIcon size={11} /> Compte requis
                      </>
                    )}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
                <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
                  {points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5">
                      <CheckCircleIcon size={16} className="mt-0.5 shrink-0 text-upl-blue-600" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-6">
                  <Link
                    to={authenticated || isPublic ? to : '/connexion'}
                    className="group inline-flex items-center gap-2 text-sm font-semibold text-upl-blue-700 hover:text-upl-blue-900"
                  >
                    {cta}
                    <ArrowRightIcon size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Présentation */}
      <section id="presentation" className="scroll-mt-16 border-y border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:px-8">
          <div>
            <div className="flex items-center gap-4">
              <UPLLogo heightClass="h-16" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-upl-blue-700">{institutionName}</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{facultyName || 'Services universitaires'}</h2>
              </div>
            </div>
            <p className="mt-6 leading-relaxed text-slate-600">
              {acronym} StageTrack réunit dans un même outil le suivi des présences en stage, la gestion des objets égarés sur le
              campus et le maintien en état des salles informatiques. Chaque opération est horodatée par le serveur et
              rattachée à son auteur.
            </p>
          </div>
          <ul className="grid gap-4">
            {GUARANTEES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-upl-blue-700 shadow-xs ring-1 ring-slate-200">
                  <Icon size={19} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{title}</span>
                  <span className="mt-0.5 block text-sm leading-snug text-slate-600">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-16 bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Besoin d'aide ou d'un renseignement ?</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
                Le secrétariat académique et le service technique des laboratoires sont à votre disposition.
              </p>
              {hasContact && (
                <ul className="mt-5 flex flex-col gap-2.5 text-sm text-slate-700 sm:flex-row sm:flex-wrap sm:gap-x-8">
                  {settings?.contactEmail && (
                    <li className="flex items-center gap-2">
                      <MailIcon size={16} className="shrink-0 text-slate-400" />
                      <a href={`mailto:${settings.contactEmail}`} className="font-medium text-upl-blue-700 hover:underline">
                        {settings.contactEmail}
                      </a>
                    </li>
                  )}
                  {settings?.contactPhone && (
                    <li className="flex items-center gap-2">
                      <PhoneIcon size={16} className="shrink-0 text-slate-400" />
                      <a href={`tel:${settings.contactPhone.replace(/\s+/g, '')}`} className="font-medium text-slate-900 hover:underline">
                        {settings.contactPhone}
                      </a>
                    </li>
                  )}
                  {settings?.address && (
                    <li className="flex items-center gap-2">
                      <MapPinIcon size={16} className="shrink-0 text-slate-400" />
                      <span>{settings.address}</span>
                    </li>
                  )}
                </ul>
              )}
            </div>
            <Link to={spaceLink} className={buttonClass('primary', 'lg', 'shrink-0')}>
              {authenticated ? 'Accéder à mon espace' : 'Se connecter au portail'}
            </Link>
          </div>
        </div>
      </section>

      {/* Pied de page */}
      <footer className="mt-auto bg-upl-blue-950 py-8 text-xs text-upl-blue-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
              <UPLLogo heightClass="h-7" decorative />
            </span>
            <span>
              © {new Date().getFullYear()} {institutionName}{facultyName ? ` — ${facultyName}` : ''}
            </span>
          </div>
          <div className="flex gap-6">
            <Link to="/objets" className="transition-colors hover:text-white">
              Objets perdus et trouvés
            </Link>
            <Link to="/connexion" className="transition-colors hover:text-white">
              Connexion
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
