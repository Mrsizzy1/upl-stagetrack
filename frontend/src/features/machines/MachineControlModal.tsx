import { useMutation, useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Field, Loading, Modal, Textarea } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { COMPONENT_STATE_LABELS } from '../../lib/format';
import type { ComponentState, MachineDetail } from '../../lib/types';

export function MachineControlModal({
  open,
  machineId,
  machineCode,
  onClose,
  onSuccess,
}: {
  open: boolean;
  machineId: string;
  machineCode: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [componentStates, setComponentStates] = useState<Record<string, { state: ComponentState; notes: string }>>({});
  const [observations, setObservations] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: machine, isLoading } = useQuery({
    queryKey: ['machine-control-detail', machineId],
    queryFn: () => api.get<MachineDetail>(`/machines/${machineId}`),
    enabled: open,
  });

  useEffect(() => {
    if (machine?.components) {
      const map: Record<string, { state: ComponentState; notes: string }> = {};
      for (const c of machine.components) {
        map[c.componentType.id] = {
          state: c.state,
          notes: c.notes ?? '',
        };
      }
      setComponentStates(map);
    }
  }, [machine]);

  const mutation = useMutation({
    mutationFn: () => {
      const components = Object.entries(componentStates).map(([componentTypeId, val]) => ({
        componentTypeId,
        state: val.state,
        notes: val.notes.trim() || undefined,
      }));

      return api.post(`/machines/${machineId}/control`, {
        observations: observations.trim() || undefined,
        components,
      });
    },
    onSuccess: () => onSuccess(),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur lors de l’enregistrement du contrôle'),
  });

  const handleStateChange = (componentTypeId: string, state: ComponentState) => {
    setComponentStates((prev) => ({
      ...prev,
      [componentTypeId]: {
        ...(prev[componentTypeId] ?? { notes: '' }),
        state,
      },
    }));
  };

  const handleNotesChange = (componentTypeId: string, notes: string) => {
    setComponentStates((prev) => ({
      ...prev,
      [componentTypeId]: {
        ...(prev[componentTypeId] ?? { state: 'FUNCTIONAL' }),
        notes,
      },
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  return (
    <Modal open={open} title={`Contrôle technique : ${machineCode}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {error && <Alert tone="danger">{error}</Alert>}

        <p className="text-xs text-slate-600">
          Vérifiez méticuleusement l'état physique et le fonctionnement de chaque composant de ce poste informatique.
          La validation créera un enregistrement immuable dans l'historique et mettra immédiatement à jour la fiche
          publique du QR code.
        </p>

        {isLoading ? (
          <Loading label="Chargement des composants..." />
        ) : (
          <div className="space-y-3">
            {machine?.components.map((c) => {
              const current = componentStates[c.componentType.id] ?? { state: c.state, notes: '' };

              return (
                <div key={c.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-upl-blue-950">{c.componentType.name}</span>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">{current.state}</span>
                  </div>

                  {/* Boutons sélecteurs de statut */}
                  <div className="grid grid-cols-5 gap-1">
                    {(['FUNCTIONAL', 'DEFECTIVE', 'MISSING', 'TO_CHECK', 'NOT_APPLICABLE'] as ComponentState[]).map(
                      (st) => {
                        const isSelected = current.state === st;
                        const btnColor =
                          st === 'FUNCTIONAL'
                            ? isSelected ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-50 text-emerald-800'
                            : st === 'DEFECTIVE'
                            ? isSelected ? 'bg-red-600 text-white' : 'hover:bg-red-50 text-red-800'
                            : st === 'MISSING'
                            ? isSelected ? 'bg-amber-600 text-white' : 'hover:bg-amber-50 text-amber-800'
                            : st === 'TO_CHECK'
                            ? isSelected ? 'bg-orange-600 text-white' : 'hover:bg-orange-50 text-orange-800'
                            : isSelected ? 'bg-slate-700 text-white' : 'hover:bg-slate-100 text-slate-700';

                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleStateChange(c.componentType.id, st)}
                            className={`py-1 px-1 rounded text-[10px] font-bold border border-slate-200 transition-colors ${btnColor}`}
                          >
                            {COMPONENT_STATE_LABELS[st]}
                          </button>
                        );
                      },
                    )}
                  </div>

                  {/* Observation facultative pour ce composant */}
                  {current.state !== 'FUNCTIONAL' && (
                    <input
                      type="text"
                      placeholder="Observation (ex: bouton gauche souris bloqué, câble dénudé...)"
                      value={current.notes}
                      onChange={(e) => handleNotesChange(c.componentType.id, e.target.value)}
                      className="block w-full text-xs rounded border border-slate-300 px-2 py-1 bg-white"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Field label="Observations générales du technicien">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              placeholder="Ex: Poste vérifié complet, mise à jour effectuée, souris nettoyée..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
          )}
        </Field>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 sticky bottom-0 bg-white">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" loading={mutation.isPending}>
            Enregistrer et Certifier le contrôle
          </Button>
        </div>
      </form>
    </Modal>
  );
}

