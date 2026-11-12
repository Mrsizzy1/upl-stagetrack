import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { NAV } from '../../components/AppLayout';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckSquareIcon,
  GraduationCapIcon,
  MonitorIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
  WrenchIcon,
} from '../../components/Icons';
import { StatCard } from '../../components/ui';
import { api } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { formatLongDate, todayInLubumbashi } from '../../lib/format';
import type { Role, SupervisionOverview } from '../../lib/types';

interface HubService {
  icon: (props: { size?: number; className?: string }) => ReactNode;
  title: string;
  description: string;
  /** Liens proposés, dans l'ordre : le premier accessible devient l'action principale. */
  links: { to: string; label: string }[];
}

const SERVICES: HubService[] = [
  {
    icon: GraduationCapIcon,
    title: 'Stages et présences',
    description: "Pointage par QR Code, feuilles d'émargement et suivi des stagiaires.",
    links: [
      { to: '/tableau-de-bord', label: 'Tableau de bord' },
      { to: '/presences', label: 'Présences' },
      { to: '/etudiants', label: 'Étudiants' },
      { to: '/rapports', label: 'Rapports' },
    ],
  },
  {
    icon: SearchIcon,
    title: 'Objets perdus et trouvés',
    description: 'Déclarations, catalogue public et restitutions.',
    links: [
      { to: '/objets', label: 'Catalogue' },
      { to: '/admin/objets', label: 'Modération' },
    ],
  },
  {
    icon: MonitorIcon,
    title: 'Salles et parc informatique',
    description: 'Plan des salles de TP, état des machines et suivi des pannes.',
    links: [
      { to: '/parc/laboratoires', label: 'Salles et laboratoires' },
      { to: '/parc/interventions', label: 'Pannes et maintenance' },
      { to: '/parc/technicien', label: 'Contrôle technique' },
    ],
  },
  {
    icon: SettingsIcon,
    title: 'Administration',
    description: "Comptes, paramètres de l'institution, journal d'audit et état du système.",
    links: [
      { to: '/comptes', label: 'Comptes' },
      { to: '/supervision', label: 'Paramètres' },
      { to: '/journal', label: "Journal d'audit" },
      { to: '/systeme', label: 'État du système' },
    ],
  },
];

const ADMIN_ROLES: Role[] = ['ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN'];

/** Un lien n'est proposé que si le rôle y a accès (même règle que la navigation latérale). */
function canOpen(to: string, role: Role): boolean {
  const item = NAV.find((n) => n.to === to);
  return item ? item.roles.includes(role) : false;
}

function Indicators() {
  const overview = useQuery({
    queryKey: ['supervision-overview'],
    queryFn: () => api.get<SupervisionOverview>('/supervision/overview'),
    refetchInterval: 60_000,
  });
  const ov = overview.data;
  if (!ov) return null;
  const rate = ov.stages.attendanceRate;
  return (
    <section aria-label="Indicateurs du jour" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Étudiants actifs" value={ov.stages.activeStudents} hint={`${ov.stages.activeInternships} stage(s) en cours`} icon={<UsersIcon size={20} />} />
      <StatCard
        label="Présences aujourd'hui"
        value={ov.stages.todayAttendances.present}
        hint={rate === null ? 'Taux disponible après la première clôture' : `Taux de présence : ${Math.round(rate)} %`}
        tone="green"
        icon={<CheckSquareIcon size={20} />}
      />
      <StatCard
        label="Objets à modérer"
        value={ov.items.pending}
        hint={`${ov.items.claimRequested} réclamation(s) ouverte(s)`}
        tone={ov.items.pending > 0 ? 'amber' : 'neutral'}
        icon={<SearchIcon size={20} />}
      />
      <StatCard
        label="Machines en panne"
        value={ov.labs.machines.defective}
        hint={`${ov.labs.activeInterventions} intervention(s) active(s) · ${ov.labs.machines.total} machines`}
        tone={ov.labs.machines.defective > 0 ? 'red' : 'neutral'}
        icon={ov.labs.machines.defective > 0 ? <AlertTriangleIcon size={20} /> : <WrenchIcon size={20} />}
      />
    </section>
  );
}

export function PortalHubPage() {
  const user = useUser();
  const isAdmin = ADMIN_ROLES.includes(user.role);
  const firstName = user.fullName.trim().split(/\s+/)[0];

  const services = SERVICES.map((s) => ({ ...s, links: s.links.filter((l) => canOpen(l.to, user.role)) })).filter((s) => s.links.length > 0);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-slate-500 first-letter:uppercase">{formatLongDate(todayInLubumbashi())}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">Bonjour, {firstName}</h1>
        <p className="mt-1.5 text-sm text-slate-600">Voici l'essentiel du portail. Choisissez un service pour commencer.</p>
      </header>

      {isAdmin && <Indicators />}

      <section aria-labelledby="hub-services">
        <h2 id="hub-services" className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Services
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          {services.map(({ icon: Icon, title, description, links }) => {
            const [main, ...others] = links;
            return (
              <article key={title} className="flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-upl-blue-50 text-upl-blue-700 ring-1 ring-inset ring-upl-blue-100">
                    <Icon size={22} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-x-1 gap-y-2 border-t border-slate-100 pt-4">
                  <Link
                    to={main.to}
                    className="group mr-2 inline-flex items-center gap-2 rounded-lg bg-upl-blue-700 px-3.5 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-upl-blue-800"
                  >
                    {main.label}
                    <ArrowRightIcon size={15} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  {others.map((l) => (
                    <Link key={l.to} to={l.to} className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                      {l.label}
                    </Link>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
