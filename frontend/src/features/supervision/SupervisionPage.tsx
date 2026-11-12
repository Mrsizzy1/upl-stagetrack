import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, ErrorAlert, Input, Loading, PageHeader, SectionTitle, StatCard } from '../../components/ui';
import { api } from '../../lib/api';
import { useUser } from '../../lib/auth';
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
    queryFn: () => api.get<InstitutionSetting>('/settings'),
  });
}

function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    // L'API refuse tout champ inconnu : seuls les champs modifiables sont envoyés (pas id ni updatedAt).
    mutationFn: (body: Partial<InstitutionSetting>) =>
      api.patch<InstitutionSetting>('/settings', Object.fromEntries(SETTING_FIELDS.map(({ key }) => [key, body[key] ?? null]))),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['institution-settings'] });
      void qc.invalidateQueries({ queryKey: ['public-settings'] });
    },
  });
}

// ─── Paramètres de l'institution ─────────────────────────────────────────────

const SETTING_FIELDS: { label: string; key: keyof InstitutionSetting }[] = [
  { label: "Nom de l'institution", key: 'institutionName' },
  { label: 'Nom de la faculté', key: 'facultyName' },
  { label: 'Acronyme', key: 'acronym' },
  { label: 'URL du logo', key: 'logoUrl' },
  { label: 'Email de contact', key: 'contactEmail' },
  { label: 'Téléphone de contact', key: 'contactPhone' },
  { label: 'Adresse', key: 'address' },
  { label: 'Sous-titre du portail', key: 'portalSubtitle' },
];

function SettingsEditor({ settings, canEdit }: { settings: InstitutionSetting; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<InstitutionSetting>>(settings);
  const update = useUpdateSettings();

  function save() {
    update.mutate(form, { onSuccess: () => setEditing(false) });
  }

  function cancel() {
    setEditing(false);
    setForm(settings);
    update.reset();
  }

  return (
    <Card
      title="Paramètres de l'institution"
      actions={
        editing ? (
          <>
            <Button variant="ghost" size="sm" onClick={cancel} disabled={update.isPending}>
              Annuler
            </Button>
            <Button size="sm" onClick={save} loading={update.isPending}>
              Enregistrer
            </Button>
          </>
        ) : canEdit ? (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Modifier
          </Button>
        ) : undefined
      }
    >
      {update.error && (
        <div className="mb-4">
          <ErrorAlert error={update.error} />
        </div>
      )}
      <dl className="-my-3 divide-y divide-slate-100">
        {SETTING_FIELDS.map(({ label, key }) => {
          const id = `setting-${key}`;
          const current = (settings[key] as string | null) ?? null;
          return (
            <div key={key} className="grid items-center gap-1 py-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm font-medium text-slate-600">{editing ? <label htmlFor={id}>{label}</label> : label}</dt>
              <dd className="min-w-0 text-sm">
                {editing ? (
                  <Input id={id} value={(form[key] as string | null) ?? ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value || null }))} />
                ) : current ? (
                  <span className="break-words font-medium text-slate-900">{current}</span>
                ) : (
                  <span className="text-slate-400">Non renseigné</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function SupervisionPage() {
  const user = useUser();
  const { data: ov, isLoading: ovLoading, error: ovError } = useOverview();
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useSettings();

  return (
    <div className="space-y-8">
      <PageHeader title="Paramètres institutionnels" description="Vue d'ensemble de tous les modules de la plateforme et identité affichée sur le portail." />

      {ovLoading && <Loading label="Chargement des indicateurs…" />}
      <ErrorAlert error={ovError} />
      {ov && (
        <div className="-mt-2 space-y-7">
          <section>
            <SectionTitle>Stages et présences</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Étudiants actifs" value={ov.stages.activeStudents} />
              <StatCard label="Stages en cours" value={ov.stages.activeInternships} />
              <StatCard label="Présences aujourd'hui" value={ov.stages.todayAttendances.present} hint={`Absences : ${ov.stages.todayAttendances.absent}`} tone="green" />
              <StatCard
                label="Taux de présence"
                value={ov.stages.attendanceRate !== null ? `${Math.round(ov.stages.attendanceRate)} %` : '—'}
                hint={ov.stages.attendanceRate === null ? 'Après la première clôture' : undefined}
                tone="amber"
              />
            </div>
          </section>

          <section>
            <SectionTitle>Objets perdus et trouvés</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Objets déclarés" value={ov.items.total} tone="neutral" />
              <StatCard label="En attente de validation" value={ov.items.pending} hint="Modération requise" tone="amber" />
              <StatCard label="Réclamations ouvertes" value={ov.items.claimRequested} tone="amber" />
              <StatCard label="Restitutions confirmées" value={ov.items.returned} tone="green" />
            </div>
          </section>

          <section>
            <SectionTitle>Parc informatique</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatCard label="Laboratoires" value={ov.labs.laboratoriesCount} />
              <StatCard label="Machines" value={ov.labs.machines.total} tone="neutral" />
              <StatCard label="Fonctionnelles" value={ov.labs.machines.functional} tone="green" />
              <StatCard label="Défectueuses" value={ov.labs.machines.defective} hint="Intervention requise" tone="red" />
              <StatCard label="Interventions actives" value={ov.labs.activeInterventions} tone="amber" />
            </div>
          </section>
        </div>
      )}

      {settingsLoading && <Loading label="Chargement des paramètres…" />}
      <ErrorAlert error={settingsError} />
      {settings && <SettingsEditor settings={settings} canEdit={user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'} />}
    </div>
  );
}
