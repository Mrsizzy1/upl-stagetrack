import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  ErrorAlert,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  Select,
  tableClass,
  TableWrap,
  tdClass,
  Textarea,
  thClass,
} from '../../components/ui';
import { api, ApiError, qs } from '../../lib/api';
import { useUser } from '../../lib/auth';
import {
  formatDate,
  formatDateTime,
  INTERVENTION_PRIORITY_LABELS,
  INTERVENTION_STATUS_LABELS,
} from '../../lib/format';
import type {
  InterventionPriority,
  InterventionStatus,
  LaboratoryListItem,
  TechnicalInterventionItem,
} from '../../lib/types';

export function InterventionsPage() {
  const user = useUser();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [declareOpen, setDeclareOpen] = useState(false);
  const [selectedIntervention, setSelectedIntervention] = useState<TechnicalInterventionItem | null>(null);

  const canManage = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'IT_TECHNICIAN';

  const queryParams = qs({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
  });

  const { data: interventions, isLoading, error } = useQuery({
    queryKey: ['interventions', queryParams],
    queryFn: () => api.get<TechnicalInterventionItem[]>(`/interventions${queryParams}`),
  });

  const priorityTone = (p: InterventionPriority) => {
    switch (p) {
      case 'CRITICAL':
        return 'danger';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'neutral';
      case 'LOW':
      default:
        return 'neutral';
    }
  };

  const statusTone = (s: InterventionStatus) => {
    switch (s) {
      case 'RESOLVED':
      case 'CLOSED':
        return 'success';
      case 'IN_PROGRESS':
        return 'warning';
      case 'REPORTED':
      case 'PENDING':
      default:
        return 'danger';
    }
  };

  return (
    <div>
      <PageHeader
        title="Interventions & Maintenance du Parc"
        description="Signalement des pannes matérielles, prise en charge des réparations, documentation des pièces remplacées et historique technique."
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setDeclareOpen(true)}>
              + Signaler une panne / intervention
            </Button>
          )
        }
      />

      <Card className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Filtrer par statut</label>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tous les statuts</option>
              {Object.entries(INTERVENTION_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Filtrer par priorité</label>
            <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="">Toutes les priorités</option>
              {Object.entries(INTERVENTION_PRIORITY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <Loading label="Chargement des interventions…" />
        ) : error ? (
          <ErrorAlert error={error} />
        ) : !interventions || interventions.length === 0 ? (
          <Empty>Aucune intervention trouvée.</Empty>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Machine & Labo</th>
                  <th className={thClass}>Panne / Titre</th>
                  <th className={thClass}>Priorité</th>
                  <th className={thClass}>Statut</th>
                  <th className={thClass}>Technicien</th>
                  <th className={thClass}>Signalé le</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-upl-blue-100">
                {interventions.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className={tdClass}>
                      <p className="font-bold text-upl-blue-950">{item.machine.code}</p>
                      <p className="text-xs text-slate-500">
                        {item.machine.laboratory.name} ({item.machine.row.name})
                      </p>
                    </td>
                    <td className={tdClass}>
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-600 line-clamp-1">{item.description}</p>
                    </td>
                    <td className={tdClass}>
                      <Badge tone={priorityTone(item.priority)}>
                        {INTERVENTION_PRIORITY_LABELS[item.priority]}
                      </Badge>
                    </td>
                    <td className={tdClass}>
                      <Badge tone={statusTone(item.status)}>
                        {INTERVENTION_STATUS_LABELS[item.status]}
                      </Badge>
                    </td>
                    <td className={tdClass}>
                      <span className="text-xs text-slate-800">
                        {item.technician ? item.technician.fullName : 'Non assigné'}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <span className="text-xs text-slate-600">{formatDate(item.reportedAt.split('T')[0])}</span>
                    </td>
                    <td className={tdClass}>
                      {canManage && (
                        <Button
                          variant="secondary"
                          className="text-xs py-1 px-2.5"
                          onClick={() => setSelectedIntervention(item)}
                        >
                          Gérer
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      {/* Modale de déclaration */}
      <CreateInterventionModal
        open={declareOpen}
        onClose={() => setDeclareOpen(false)}
        onSuccess={() => {
          setDeclareOpen(false);
          void queryClient.invalidateQueries({ queryKey: ['interventions'] });
        }}
      />

      {/* Modale de gestion/résolution */}
      {selectedIntervention && (
        <ManageInterventionModal
          open={Boolean(selectedIntervention)}
          intervention={selectedIntervention}
          onClose={() => setSelectedIntervention(null)}
          onSuccess={() => {
            setSelectedIntervention(null);
            void queryClient.invalidateQueries({ queryKey: ['interventions'] });
          }}
        />
      )}
    </div>
  );
}

function CreateInterventionModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedLabId, setSelectedLabId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<InterventionPriority>('MEDIUM');
  const [error, setError] = useState<string | null>(null);

  const { data: labs } = useQuery({
    queryKey: ['labs-for-intervention'],
    queryFn: () => api.get<LaboratoryListItem[]>('/labs'),
    enabled: open,
  });

  const { data: labDetail } = useQuery({
    queryKey: ['lab-detail-for-interv', selectedLabId],
    queryFn: () => api.get<any>(`/labs/${selectedLabId}`),
    enabled: Boolean(selectedLabId),
  });

  const allMachines = (labDetail?.rows ?? []).flatMap((r: any) => r.machines ?? []);

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/interventions', {
        machineId,
        title: title.trim(),
        description: description.trim(),
        priority,
      }),
    onSuccess: () => onSuccess(),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur lors du signalement'),
  });

  return (
    <Modal open={open} title="Signaler une panne / intervention" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
        className="space-y-4"
      >
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Laboratoire" required>
            {() => (
              <Select value={selectedLabId} onChange={(e) => { setSelectedLabId(e.target.value); setMachineId(''); }}>
                <option value="">Sélectionnez un laboratoire</option>
                {labs?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Poste / Machine" required>
            {() => (
              <Select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                disabled={!selectedLabId || allMachines.length === 0}
              >
                <option value="">Sélectionnez une machine</option>
                {allMachines.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.code} ({m.name})
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Titre de la panne / anomalie" hint="Ex: Écran noir, souris absente, Windows ne démarre plus..." required>
          {(id) => (
            <Input
              id={id}
              required
              minLength={3}
              placeholder="Ex: Écran ne s'allume plus"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>

        <Field label="Priorité de l'intervention" required>
          {() => (
            <Select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
              {Object.entries(INTERVENTION_PRIORITY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Description détaillée du dysfonctionnement" required>
          {(id) => (
            <Textarea
              id={id}
              required
              minLength={5}
              rows={3}
              placeholder="Précisez les circonstances de la panne, les tests effectués..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" loading={mutation.isPending} disabled={!machineId}>
            Enregistrer l'intervention
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ManageInterventionModal({
  open,
  intervention,
  onClose,
  onSuccess,
}: {
  open: boolean;
  intervention: TechnicalInterventionItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState<InterventionStatus>(intervention.status);
  const [priority, setPriority] = useState<InterventionPriority>(intervention.priority);
  const [resolutionReport, setResolutionReport] = useState(intervention.resolutionReport ?? '');
  const [replacedParts, setReplacedParts] = useState(intervention.replacedParts ?? '');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/interventions/${intervention.id}`, {
        status,
        priority,
        resolutionReport: resolutionReport.trim() || undefined,
        replacedParts: replacedParts.trim() || undefined,
      }),
    onSuccess: () => onSuccess(),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur de mise à jour'),
  });

  return (
    <Modal open={open} title={`Intervention : ${intervention.title}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
        className="space-y-4"
      >
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
          <p>
            <strong>Poste concerné :</strong> {intervention.machine.code} ({intervention.machine.laboratory.name})
          </p>
          <p>
            <strong>Description signalée :</strong> {intervention.description}
          </p>
          <p>
            <strong>Signalé le :</strong> {formatDateTime(intervention.reportedAt)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Statut de l'intervention">
            {() => (
              <Select value={status} onChange={(e) => setStatus(e.target.value as any)}>
                {Object.entries(INTERVENTION_STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Priorité">
            {() => (
              <Select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                {Object.entries(INTERVENTION_PRIORITY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Pièces remplacées / ajoutées (optionnel)">
          {(id) => (
            <Input
              id={id}
              placeholder="Ex: Câble HDMI neuf, Souris USB optique Dell..."
              value={replacedParts}
              onChange={(e) => setReplacedParts(e.target.value)}
            />
          )}
        </Field>

        <Field label="Compte rendu technique de l'intervention">
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              placeholder="Actions de réparation effectuées, tests fonctionnels validés..."
              value={resolutionReport}
              onChange={(e) => setResolutionReport(e.target.value)}
            />
          )}
        </Field>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" loading={mutation.isPending}>
            Mettre à jour l'intervention
          </Button>
        </div>
      </form>
    </Modal>
  );
}

