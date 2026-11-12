import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { PlusIcon, SmartphoneIcon, WrenchIcon } from '../../components/Icons';
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
  StatCard,
  Textarea,
} from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useUser } from '../../lib/auth';
import type { LaboratoryListItem } from '../../lib/types';

export function LabsPage() {
  const user = useUser();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const canManage = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'IT_TECHNICIAN';

  const { data: labs, isLoading, error } = useQuery({
    queryKey: ['laboratories'],
    queryFn: () => api.get<LaboratoryListItem[]>('/labs'),
  });

  const totalMachines = labs?.reduce((acc, l) => acc + (l.stats?.total || 0), 0) ?? 0;
  const functionalMachines = labs?.reduce((acc, l) => acc + (l.stats?.functional || 0), 0) ?? 0;
  const defectiveMachines = labs?.reduce((acc, l) => acc + (l.stats?.defective || 0), 0) ?? 0;
  const healthRate = totalMachines > 0 ? Math.round((functionalMachines / totalMachines) * 100) : 100;

  return (
    <div>
      <PageHeader
        title="Salles informatiques & Ordinateurs"
        description="Consultez les ordinateurs installés dans chaque salle et suivez les réparations."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/parc/technicien">
              <Button variant="secondary" className="inline-flex items-center gap-1.5">
                <SmartphoneIcon size={16} />
                <span>Scanner un poste</span>
              </Button>
            </Link>
            <Link to="/parc/interventions">
              <Button variant="secondary" className="inline-flex items-center gap-1.5">
                <WrenchIcon size={16} />
                <span>Pannes & Réparations</span>
              </Button>
            </Link>
            {canManage && (
              <Button variant="primary" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1.5">
                <PlusIcon size={16} />
                <span>Ajouter une salle</span>
              </Button>
            )}
          </div>
        }
      />

      {labs && labs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Salles informatiques" value={labs.length} />
          <StatCard label="Total des ordinateurs" value={totalMachines} />
          <StatCard
            label="Ordinateurs fonctionnels"
            value={functionalMachines}
            hint={`${healthRate}% en bon état`}
            tone="green"
          />
          <StatCard
            label="Ordinateurs en panne"
            value={defectiveMachines}
            hint={defectiveMachines > 0 ? 'Réparation nécessaire' : 'Tous en état'}
            tone={defectiveMachines > 0 ? 'red' : 'green'}
          />
        </div>
      )}

      {isLoading ? (
        <Loading label="Chargement des salles…" />
      ) : error ? (
        <ErrorAlert error={error} />
      ) : !labs || labs.length === 0 ? (
        <Card>
          <Empty>
            Aucune salle informatique n'a encore été créée.
            {canManage && (
              <div className="mt-4">
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  + Créer la première salle
                </Button>
              </div>
            )}
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {labs.map((lab) => (
            <div
              key={lab.id}
              className="bg-white rounded-xl shadow-xs ring-1 ring-slate-200 overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-upl-blue-100 text-upl-blue-900">
                    {lab.code}
                  </span>
                  <Badge tone={lab.isActive ? 'success' : 'neutral'}>
                    {lab.isActive ? 'Actif' : 'Désactivé'}
                  </Badge>
                </div>

                <h3 className="text-lg font-bold text-upl-blue-950 mb-1">{lab.name}</h3>
                <p className="text-xs text-slate-500 mb-4">
                  {lab.building} — {lab.location}
                </p>

                {lab.description && (
                  <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">
                    {lab.description}
                  </p>
                )}

                {/* KPIs synthétiques */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                  <div>
                    <span className="block text-lg font-extrabold text-slate-900">{lab.stats.total}</span>
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Postes</span>
                  </div>
                  <div>
                    <span className="block text-lg font-extrabold text-success-700">{lab.stats.functional}</span>
                    <span className="block text-[10px] uppercase font-bold text-slate-500">OK</span>
                  </div>
                  <div>
                    <span className="block text-lg font-extrabold text-danger-700">
                      {lab.stats.defective + lab.stats.toCheck}
                    </span>
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Alertes</span>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0">
                <Link
                  to={`/parc/laboratoires/${lab.id}`}
                  className="w-full inline-flex items-center justify-center rounded-lg bg-upl-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-upl-blue-800 transition-colors"
                >
                  Ouvrir le laboratoire & plan interactif →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateLabModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          void queryClient.invalidateQueries({ queryKey: ['laboratories'] });
        }}
      />
    </div>
  );
}

function CreateLabModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [building, setBuilding] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/labs', {
        code: code.trim(),
        name: name.trim(),
        building: building.trim(),
        location: location.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      setCode('');
      setName('');
      setBuilding('');
      setLocation('');
      setDescription('');
      onSuccess();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur de création'),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  return (
    <Modal open={open} title="Nouveau laboratoire informatique" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <p className="text-xs text-slate-600">
          Trois rangées initiales (Rangée Gauche, Rangée Milieu, Rangée Droite) seront créées automatiquement. Vous
          pourrez ensuite ajouter autant de rangées que nécessaire.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Code unique" hint="Ex: LAB01, LAB02..." required>
            {(id) => (
              <Input
                id={id}
                required
                minLength={2}
                placeholder="LAB01"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            )}
          </Field>

          <Field label="Nom du laboratoire" required>
            {(id) => (
              <Input
                id={id}
                required
                minLength={2}
                placeholder="Salle Informatique 1 (Génie Logiciel)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Bâtiment" required>
            {(id) => (
              <Input
                id={id}
                required
                placeholder="Bâtiment Sciences"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
              />
            )}
          </Field>

          <Field label="Localisation / Salle" required>
            {(id) => (
              <Input
                id={id}
                required
                placeholder="1er étage, Salle 104"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            )}
          </Field>
        </div>

        <Field label="Description">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              placeholder="Capacité, spécialité, équipements particuliers..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" loading={mutation.isPending}>
            Créer le laboratoire
          </Button>
        </div>
      </form>
    </Modal>
  );
}

