import { useQuery } from '@tanstack/react-query';
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
    <section aria-labelledby="status-title" className="space-y-6">
      <div>
        <h1 id="status-title" className="text-2xl font-semibold text-upl-blue-900">
          État du système
        </h1>
        <p className="mt-1 text-sm text-upl-blue-800">
          L'heure affichée est celle du serveur : c'est la seule qui compte pour les pointages.
        </p>
      </div>

      {health.isPending && <p className="text-upl-blue-800">Connexion au serveur…</p>}

      {health.isError && (
        <div role="alert" className="rounded-lg border border-danger-700/30 bg-danger-100 p-4 text-danger-700">
          <p className="font-semibold">
            {health.error instanceof ApiError && health.error.code === 'DATABASE_UNAVAILABLE'
              ? 'Base de données injoignable'
              : 'Erreur de connexion'}
          </p>
          <p className="text-sm mt-1">{health.error.message}</p>
        </div>
      )}

      {health.data && (
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-upl-blue-100">
            <dt className="text-sm text-upl-blue-800">Heure officielle du serveur</dt>
            <dd className="mt-2 text-3xl font-semibold tabular-nums text-upl-blue-900">{health.data.localTime}</dd>
            <dd className="mt-1 text-xs text-upl-blue-800">Actualisée toutes les 15 secondes</dd>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-upl-blue-100">
            <dt className="text-sm text-upl-blue-800">Date</dt>
            <dd className="mt-2 text-lg font-semibold first-letter:uppercase text-upl-blue-900">
              {formatServerDate(health.data.localDate)}
            </dd>
            <dd className="mt-1 text-xs text-upl-blue-800">Fuseau {health.data.timeZone}</dd>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-upl-blue-100">
            <dt className="text-sm text-upl-blue-800">Base de données</dt>
            <dd className="mt-2 inline-flex items-center gap-2 rounded-full bg-success-100 px-3 py-1 text-sm font-semibold text-success-700">
              <span aria-hidden className="h-2 w-2 rounded-full bg-success-600" />
              Disponible
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
