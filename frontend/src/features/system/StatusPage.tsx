import { useQuery } from '@tanstack/react-query';
import { ClockIcon, CalendarIcon, ShieldCheckIcon } from '../../components/Icons';
import { Alert, Loading, PageHeader } from '../../components/ui';
import { apiFetch, ApiError } from '../../lib/api';

interface Health {
  status: 'ok';
  database: 'up';
  serverTime: string;
  timeZone: string;
  localDate: string;
  localTime: string;
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Affiche la date locale AAAA-MM-JJ fournie par le serveur, sans recalcul par le navigateur. */
function formatServerDate(localDate: string): string {
  return dateFormatter.format(new Date(`${localDate}T00:00:00Z`));
}

export function StatusPage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<Health>('/health'),
    refetchInterval: 15_000,
  });

  return (
    <section>
      <PageHeader title="État du système" description="L'heure affichée est celle du serveur : c'est la seule qui compte pour les pointages." />

      {health.isPending && <Loading label="Connexion au serveur…" />}

      {health.isError && (
        <Alert
          tone="danger"
          title={health.error instanceof ApiError && health.error.code === 'DATABASE_UNAVAILABLE' ? 'Base de données injoignable' : 'Erreur de connexion'}
        >
          {health.error.message}
        </Alert>
      )}

      {health.data && (
        <dl className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <dt className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
              <ClockIcon size={16} className="text-slate-400" />
              Heure officielle du serveur
            </dt>
            <dd className="mt-3 text-4xl font-semibold leading-none tracking-tight tabular-nums text-slate-900">{health.data.localTime}</dd>
            <dd className="mt-3 text-xs text-slate-500">Actualisée toutes les 15 secondes</dd>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <dt className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
              <CalendarIcon size={16} className="text-slate-400" />
              Date
            </dt>
            <dd className="mt-3 text-lg font-semibold text-slate-900 first-letter:uppercase">{formatServerDate(health.data.localDate)}</dd>
            <dd className="mt-3 text-xs text-slate-500">Fuseau {health.data.timeZone}</dd>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <dt className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
              <ShieldCheckIcon size={16} className="text-slate-400" />
              Base de données
            </dt>
            <dd className="mt-3 inline-flex items-center gap-2 rounded-full bg-success-50 px-3 py-1 text-sm font-semibold text-success-800 ring-1 ring-inset ring-success-200">
              <span aria-hidden className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success-600" />
              </span>
              Disponible
            </dd>
            <dd className="mt-3 text-xs text-slate-500">API et base opérationnelles</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
