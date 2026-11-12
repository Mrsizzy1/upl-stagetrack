import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { SupervisionOverview, InstitutionSetting } from '../../lib/types';

// ─── API helpers ─────────────────────────────────────────────────────────────

function useOverview() {
  return useQuery<SupervisionOverview>({
    queryKey: ['supervision-overview'],
    queryFn: () => api.get<SupervisionOverview>('/supervision/overview'),
    refetchInterval: 60_000,
  });
}

function useSettings() {
  return useQuery<InstitutionSetting>({
    queryKey: ['institution-settings'],
    queryFn: () => api.get<InstitutionSetting>('/supervision/settings'),
  });
}

function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<InstitutionSetting>) =>
      api.put<InstitutionSetting>('/supervision/settings', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['institution-settings'] }),
  });
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color: 'blue' | 'gold' | 'red' | 'green' | 'gray';
}) {
  const ring: Record<string, string> = {
    blue: 'ring-upl-blue-700',
    gold: 'ring-upl-gold-500',
    red: 'ring-red-500',
    green: 'ring-emerald-500',
    gray: 'ring-gray-300',
  };
  const textColor: Record<string, string> = {
    blue: 'text-upl-blue-800',
    gold: 'text-amber-800',
    red: 'text-red-700',
    green: 'text-emerald-700',
    gray: 'text-gray-700',
  };
  return (
    <div className={`rounded-xl bg-white p-5 ring-1 ${ring[color]} shadow-sm`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${textColor[color]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ─── Settings editor ─────────────────────────────────────────────────────────

function SettingsEditor({ settings }: { settings: InstitutionSetting }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<InstitutionSetting>>(settings);
  const update = useUpdateSettings();

  function save() {
    update.mutate(form, { onSuccess: () => setEditing(false) });
  }

  function field(label: string, key: keyof InstitutionSetting) {
    const value = (form[key] as string | null) ?? '';
    return (
      <tr className="hover:bg-gray-50">
        <td className="py-3 pl-4 pr-3 text-sm font-medium text-gray-600">{label}</td>
        <td className="py-3 px-3 text-sm">
          {editing ? (
            <input
              className="w-full rounded border border-upl-blue-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-upl-blue-500"
              value={value}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value || null }))}
            />
          ) : (
            <span className="font-medium text-gray-900">
              {(settings[key] as string | null) ?? <em className="text-gray-400">vide</em>}
            </span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-gray-200 shadow-sm bg-white">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className="text-sm font-semibold text-gray-700">Paramètres de l'institution</span>
        <span className="flex gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={save}
                disabled={update.isPending}
                className="rounded bg-upl-blue-700 px-3 py-1 text-xs font-semibold text-white hover:bg-upl-blue-800 disabled:opacity-50"
              >
                {update.isPending ? '…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setForm(settings); }}
                className="rounded bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200"
              >
                Annuler
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-semibold text-upl-blue-700 hover:underline"
            >
              Modifier
            </button>
          )}
        </span>
      </div>
      <table className="min-w-full divide-y divide-gray-100">
        <tbody className="divide-y divide-gray-100 bg-white">
          {field('Nom de l\'institution', 'institutionName')}
          {field('Nom de la faculté', 'facultyName')}
          {field('Acronyme', 'acronym')}
          {field('URL du logo', 'logoUrl')}
          {field('Email de contact', 'contactEmail')}
          {field('Téléphone de contact', 'contactPhone')}
          {field('Adresse', 'address')}
          {field('Sous-titre du portail', 'portalSubtitle')}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function SupervisionPage() {
  const { data: ov, isLoading: ovLoading, error: ovError } = useOverview();
  const { data: settings, isLoading: settingsLoading } = useSettings();

  return (
    <div className="space-y-10">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-upl-blue-900">Supervision centrale</h1>
        <p className="mt-1 text-sm text-gray-500">
          Vue d'ensemble de tous les modules de la plateforme UPL StageTrack.
        </p>
      </div>

      {/* KPI grid */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-gray-700 uppercase tracking-wide">Indicateurs globaux</h2>
        {ovLoading && <p className="text-sm text-gray-400">Chargement des indicateurs…</p>}
        {ovError && <p className="text-sm text-red-600">Impossible de charger les indicateurs.</p>}
        {ov && (
          <>
            {/* Stages */}
            <div className="mb-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-upl-blue-700">
                Stages &amp; Présences
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Étudiants actifs" value={ov.stages.activeStudents} color="blue" />
                <StatCard label="Stages en cours" value={ov.stages.activeInternships} color="blue" />
                <StatCard
                  label="Présences aujourd'hui"
                  value={ov.stages.todayAttendances.present}
                  sub={`Absences : ${ov.stages.todayAttendances.absent}`}
                  color="green"
                />
                <StatCard
                  label="Taux de présence"
                  value={ov.stages.attendanceRate !== null ? `${Math.round(ov.stages.attendanceRate)}%` : '—'}
                  color="gold"
                />
              </div>
            </div>

            {/* Objets perdus */}
            <div className="mb-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-upl-blue-700">
                Objets perdus &amp; trouvés
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Objets totaux" value={ov.items.total} color="gray" />
                <StatCard label="En attente de validation" value={ov.items.pending} color="gold" sub="Modération requise" />
                <StatCard label="Réclamations ouvertes" value={ov.items.claimRequested} color="gold" />
                <StatCard label="Restitutions confirmées" value={ov.items.returned} color="green" />
              </div>
            </div>

            {/* Parc informatique */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-upl-blue-700">
                Parc informatique
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <StatCard label="Laboratoires" value={ov.labs.laboratoriesCount} color="blue" />
                <StatCard label="Machines totales" value={ov.labs.machines.total} color="gray" />
                <StatCard label="Fonctionnelles" value={ov.labs.machines.functional} color="green" />
                <StatCard label="Défectueuses" value={ov.labs.machines.defective} color="red" sub="Intervention requise" />
                <StatCard label="Interventions actives" value={ov.labs.activeInterventions} color="gold" />
              </div>
            </div>
          </>
        )}
      </section>

      {/* Institution settings */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-gray-700 uppercase tracking-wide">
          Paramètres de l'institution
        </h2>
        {settingsLoading && <p className="text-sm text-gray-400">Chargement des paramètres…</p>}
        {settings && <SettingsEditor settings={settings} />}
      </section>
    </div>
  );
}
