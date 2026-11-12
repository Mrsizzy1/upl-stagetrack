import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { UPLLogo } from '../../components/UPLLogo';
import { SmartphoneIcon, WrenchIcon } from '../../components/Icons';
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorAlert,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  Select,
  StatCard,
  tableClass,
  TableWrap,
  tdClass,
  thClass,
} from '../../components/ui';
import { api, ApiError, downloadFile } from '../../lib/api';
import { useUser } from '../../lib/auth';
import {
  formatDate,
  MACHINE_STATUS_LABELS,
} from '../../lib/format';
import type { LaboratoryListItem, MachineListItem, MachineStatus } from '../../lib/types';
import { MachineControlModal } from '../machines/MachineControlModal';

export function LabDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useUser();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<'visual' | 'table'>('visual');
  const [statusFilter, setStatusFilter] = useState<MachineStatus | 'ALL'>('ALL');

  // Modales
  const [selectedMachine, setSelectedMachine] = useState<MachineListItem | null>(null);
  const [controlMachine, setControlMachine] = useState<MachineListItem | null>(null);
  const [addMachineOpen, setAddMachineOpen] = useState(false);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);

  const canManage = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'IT_TECHNICIAN';

  const { data: lab, isLoading, error } = useQuery({
    queryKey: ['laboratory', id],
    queryFn: () => api.get<LaboratoryListItem>(`/labs/${id}`),
    enabled: Boolean(id),
  });

  const handlePrintStickers = async () => {
    if (!id) return;
    setPrintingPdf(true);
    try {
      await downloadFile(`/labs/${id}/stickers-pdf`, `etiquettes-qr-${lab?.code ?? 'lab'}.pdf`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur lors de la génération du PDF');
    } finally {
      setPrintingPdf(false);
    }
  };

  const statusBg = (status: MachineStatus) => {
    switch (status) {
      case 'FUNCTIONAL':
        return 'bg-success-500 text-white';
      case 'TO_CHECK':
        return 'bg-upl-gold-500 text-white';
      case 'DEFECTIVE':
        return 'bg-danger-600 text-white';
      case 'MAINTENANCE':
        return 'bg-upl-blue-600 text-white';
      case 'OUT_OF_SERVICE':
      default:
        return 'bg-slate-600 text-white';
    }
  };

  const statusBorder = (status: MachineStatus) => {
    switch (status) {
      case 'FUNCTIONAL':
        return 'border-success-500/50 hover:border-success-600';
      case 'TO_CHECK':
        return 'border-upl-gold-500/50 hover:border-upl-gold-600';
      case 'DEFECTIVE':
        return 'border-danger-500/50 hover:border-danger-600';
      case 'MAINTENANCE':
        return 'border-upl-blue-500/50 hover:border-upl-blue-600';
      case 'OUT_OF_SERVICE':
      default:
        return 'border-slate-400 hover:border-slate-600';
    }
  };

  return (
    <div>
      {isLoading ? (
        <Loading label="Chargement du laboratoire…" />
      ) : error || !lab ? (
        <ErrorAlert error={error ?? new Error('Laboratoire introuvable')} />
      ) : (
        <div>
          <PageHeader
            title={`${lab.code} — ${lab.name}`}
            description={`${lab.building} • ${lab.location} • ${lab.description ?? ''}`}
            actions={
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={handlePrintStickers} loading={printingPdf}>
                  Imprimer les étiquettes QR (PDF)
                </Button>
                {canManage && (
                  <>
                    <Button variant="secondary" onClick={() => setAddRowOpen(true)}>
                      + Ajouter une rangée
                    </Button>
                    <Button variant="primary" onClick={() => setAddMachineOpen(true)}>
                      + Ajouter une machine
                    </Button>
                  </>
                )}
              </div>
            }
          />

          {/* Cartes statistiques du laboratoire */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <StatCard label="Total Postes" value={lab.stats.total} />
            <StatCard label="Fonctionnelles" value={lab.stats.functional} tone="green" />
            <StatCard label="À vérifier" value={lab.stats.toCheck} tone="amber" />
            <StatCard label="Défectueuses" value={lab.stats.defective} tone="red" />
            <StatCard label="En maintenance" value={lab.stats.maintenance} />
            <StatCard label="Hors service" value={lab.stats.outOfService} />
          </div>

          {/* Barre d'outils et sélecteur de vue */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Mode d'affichage :</span>
              <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode('visual')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    viewMode === 'visual' ? 'bg-white shadow-xs text-upl-blue-900' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Plan de la salle
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    viewMode === 'table' ? 'bg-white shadow-xs text-upl-blue-900' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Liste détaillée
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Filtrer par état :</span>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs py-1 h-8"
              >
                <option value="ALL">Tous les états</option>
                <option value="FUNCTIONAL">Fonctionnelles</option>
                <option value="TO_CHECK">À vérifier</option>
                <option value="DEFECTIVE">Défectueuses</option>
                <option value="MAINTENANCE">En maintenance</option>
                <option value="OUT_OF_SERVICE">Hors service</option>
              </Select>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* VUE 1 : PLAN VISUEL 2D INTERACTIF DU LABORATOIRE                 */}
          {/* ---------------------------------------------------------------- */}
          {viewMode === 'visual' ? (
            <div className="space-y-6">
              {/* Légende interactive */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-bold">Légende :</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-success-500" /> Fonctionnelle
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-upl-gold-500" /> À vérifier
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-danger-600" /> Défectueuse
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-upl-blue-600" /> En maintenance
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-slate-600" /> Hors service
                </span>
              </div>

              {/* Disposition spatiale par rangées */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {lab.rows?.map((row) => {
                  const filteredMachines = (row.machines ?? []).filter(
                    (m) => statusFilter === 'ALL' || m.generalStatus === statusFilter,
                  );

                  return (
                    <div
                      key={row.id}
                      className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                        <div>
                          <span className="text-xs font-bold text-upl-blue-700 bg-upl-blue-50 px-2 py-0.5 rounded">
                            {row.code}
                          </span>
                          <h3 className="font-bold text-sm text-slate-900 mt-1">{row.name}</h3>
                        </div>
                        <span className="text-xs font-semibold text-slate-400">
                          {row.machines?.length ?? 0} machine(s)
                        </span>
                      </div>

                      {filteredMachines.length === 0 ? (
                        <p className="text-xs text-slate-400 py-8 text-center italic">
                          Aucun poste dans cette rangée pour ce filtre.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 flex-1">
                          {filteredMachines.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setSelectedMachine(m)}
                              className={`p-3 rounded-xl border-2 text-left transition-all active:scale-95 bg-slate-50/50 hover:bg-white hover:shadow-md cursor-pointer ${statusBorder(
                                m.generalStatus,
                              )}`}
                            >
                              <div className="flex items-center justify-between gap-1 mb-2">
                                <span className="text-[10px] font-bold text-slate-500">#{m.positionInRow}</span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${statusBg(
                                    m.generalStatus,
                                  )}`}
                                >
                                  {MACHINE_STATUS_LABELS[m.generalStatus]}
                                </span>
                              </div>

                              <p className="font-extrabold text-xs text-slate-900 truncate">{m.code}</p>
                              <p className="text-[11px] text-slate-600 truncate mt-0.5">{m.name}</p>

                              {m.brand && (
                                <p className="text-[10px] text-slate-400 truncate mt-1">
                                  {m.brand} {m.model ?? ''}
                                </p>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ---------------------------------------------------------------- */
            /* VUE 2 : TABLEAU DÉTAILLÉ SYNCHRONISÉ                              */
            /* ---------------------------------------------------------------- */
            <Card>
              <TableWrap>
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th className={thClass}>Code Machine</th>
                      <th className={thClass}>Rangée & Pos.</th>
                      <th className={thClass}>Marque / Modèle</th>
                      <th className={thClass}>État général</th>
                      <th className={thClass}>Dernier contrôle</th>
                      <th className={thClass}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {lab.rows
                      ?.flatMap((r) => (r.machines ?? []).map((m) => ({ ...m, rowName: r.name, rowCode: r.code })))
                      .filter((m) => statusFilter === 'ALL' || m.generalStatus === statusFilter)
                      .map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                          <td className={tdClass}>
                            <p className="font-bold text-slate-900">{m.code}</p>
                            <p className="text-xs text-slate-500">{m.name}</p>
                          </td>
                          <td className={tdClass}>
                            <span className="text-xs font-medium text-slate-800">
                              {m.rowName} (#{m.positionInRow})
                            </span>
                          </td>
                          <td className={tdClass}>
                            <span className="text-xs text-slate-700">
                              {m.brand ? `${m.brand} ${m.model ?? ''}` : '—'}
                            </span>
                          </td>
                          <td className={tdClass}>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBg(
                                m.generalStatus,
                              )}`}
                            >
                              {MACHINE_STATUS_LABELS[m.generalStatus]}
                            </span>
                          </td>
                          <td className={tdClass}>
                            <span className="text-xs text-slate-600">
                              {m.lastControlAt ? formatDate(m.lastControlAt.split('T')[0]) : 'Aucun'}
                            </span>
                          </td>
                          <td className={tdClass}>
                            <div className="flex gap-2">
                              <Button
                                variant="secondary"
                                className="text-xs py-1 px-2.5"
                                onClick={() => setSelectedMachine(m)}
                              >
                                Détails
                              </Button>
                              {canManage && (
                                <Button
                                  variant="primary"
                                  className="text-xs py-1 px-2.5"
                                  onClick={() => setControlMachine(m)}
                                >
                                  Contrôler
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </TableWrap>
            </Card>
          )}

          {/* Tiroir / Modale détaillée d'une machine cliquée */}
          {selectedMachine && (
            <MachineDrawerModal
              machine={selectedMachine}
              onClose={() => setSelectedMachine(null)}
              onLaunchControl={() => {
                setControlMachine(selectedMachine);
                setSelectedMachine(null);
              }}
            />
          )}

          {/* Modale de contrôle composant par composant */}
          {controlMachine && (
            <MachineControlModal
              machineId={controlMachine.id}
              machineCode={controlMachine.code}
              open={Boolean(controlMachine)}
              onClose={() => setControlMachine(null)}
              onSuccess={() => {
                setControlMachine(null);
                void queryClient.invalidateQueries({ queryKey: ['laboratory', id] });
              }}
            />
          )}

          {/* Modale d'ajout d'une machine */}
          {lab && (
            <AddMachineModal
              open={addMachineOpen}
              laboratoryId={lab.id}
              rows={lab.rows ?? []}
              onClose={() => setAddMachineOpen(false)}
              onSuccess={() => {
                setAddMachineOpen(false);
                void queryClient.invalidateQueries({ queryKey: ['laboratory', id] });
              }}
            />
          )}

          {/* Modale d'ajout d'une rangée */}
          {lab && (
            <AddRowModal
              open={addRowOpen}
              laboratoryId={lab.id}
              onClose={() => setAddRowOpen(false)}
              onSuccess={() => {
                setAddRowOpen(false);
                void queryClient.invalidateQueries({ queryKey: ['laboratory', id] });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MachineDrawerModal({
  machine,
  onClose,
  onLaunchControl,
}: {
  machine: MachineListItem;
  onClose: () => void;
  onLaunchControl: () => void;
}) {
  const user = useUser();
  const canManage = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'IT_TECHNICIAN';

  return (
    <Modal open={true} title={`Poste : ${machine.code}`} onClose={onClose}>
      <div className="space-y-4 text-xs text-slate-700">
        {/* Étiquette d'inventaire épurée et professionnelle */}
        <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs">
          {/* Bandeau officiel UPL */}
          <div className="bg-upl-blue-900 text-white px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UPLLogo size="sm" priority />
              <div className="leading-tight">
                <span className="block font-bold text-[10px] tracking-tight text-white">
                  UNIVERSITÉ PROTESTANTE DE LUBUMBASHI
                </span>
                <span className="block text-[8px] text-upl-gold-400 font-semibold">
                  PARC INFORMATIQUE • POSTE DE TRAVAIL
                </span>
              </div>
            </div>
            <Badge
              tone={
                machine.generalStatus === 'FUNCTIONAL'
                  ? 'success'
                  : machine.generalStatus === 'DEFECTIVE'
                  ? 'danger'
                  : 'warning'
              }
            >
              {MACHINE_STATUS_LABELS[machine.generalStatus]}
            </Badge>
          </div>

          {/* Corps de l'étiquette avec espaces aérés */}
          <div className="p-4 flex items-center gap-4 bg-slate-50/50">
            <div className="bg-white p-1.5 rounded-lg border border-slate-200 shrink-0 shadow-xs">
              <img
                src={`/api/machines/${machine.id}/qr-png`}
                alt={`QR Code ${machine.code}`}
                className="w-24 h-24 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                    window.location.origin + '/m/' + machine.publicToken,
                  )}`;
                }}
              />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Code du poste
              </span>
              <p className="font-mono text-xl font-black text-slate-900 tracking-tight">
                {machine.code}
              </p>
              <p className="text-xs font-semibold text-slate-700 truncate">
                {machine.name} • N°{machine.positionInRow}
              </p>
              <div className="pt-1.5">
                <span className="inline-block text-[10px] font-semibold text-slate-700 bg-slate-200 px-2.5 py-0.5 rounded">
                  Scannez pour signaler
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-100 border-t border-slate-200 px-3 py-1 text-center">
            <span className="text-[9px] font-medium text-slate-400">
              UPL • Faculté des Sciences Informatiques
            </span>
          </div>
        </div>

        {/* Boutons d'action clairs et simples */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          {canManage && (
            <Button
              variant="primary"
              className="flex-1 justify-center inline-flex items-center gap-1.5"
              onClick={onLaunchControl}
            >
              <WrenchIcon size={14} />
              <span>Diagnostiquer ce poste</span>
            </Button>
          )}
          <Link
            to={`/m/${machine.publicToken}`}
            target="_blank"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-2 text-xs font-semibold transition-colors"
          >
            <SmartphoneIcon size={14} />
            <span>Fiche mobile</span>
          </Link>
        </div>

        {/* Boutons de fermeture et contrôle */}
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          {canManage && (
            <Button variant="primary" onClick={onLaunchControl} className="inline-flex items-center gap-1.5">
              <WrenchIcon size={14} />
              <span>Contrôle technique</span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function AddMachineModal({
  open,
  laboratoryId,
  rows,
  onClose,
  onSuccess,
}: {
  open: boolean;
  laboratoryId: string;
  rows: { id: string; code: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rowId, setRowId] = useState(rows[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [positionInRow, setPositionInRow] = useState(1);
  const [brand, setBrand] = useState('Dell');
  const [model, setModel] = useState('OptiPlex');
  const [serialNumber, setSerialNumber] = useState('');
  const [specifications, setSpecifications] = useState('Intel Core i7, 16 Go RAM, 512 Go SSD');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/machines', {
        laboratoryId,
        rowId,
        code: code.trim(),
        name: name.trim(),
        positionInRow: Number(positionInRow),
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        specifications: specifications.trim() || undefined,
      }),
    onSuccess: () => onSuccess(),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur lors de la création de la machine'),
  });

  return (
    <Modal open={open} title="Ajouter une machine" onClose={onClose}>
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
          <Field label="Rangée" required>
            {() => (
              <Select value={rowId} onChange={(e) => setRowId(e.target.value)}>
                {rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Position dans la rangée" required>
            {(id) => (
              <Input
                id={id}
                type="number"
                min={1}
                required
                value={positionInRow}
                onChange={(e) => setPositionInRow(Number(e.target.value))}
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Code machine" hint="Ex: LAB01-RG-M01" required>
            {(id) => (
              <Input
                id={id}
                required
                placeholder="Code d'inventaire réel"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            )}
          </Field>

          <Field label="Nom du poste" required>
            {(id) => (
              <Input
                id={id}
                required
                placeholder="Nom ou type de machine"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Marque">
            {(id) => <Input id={id} value={brand} onChange={(e) => setBrand(e.target.value)} />}
          </Field>
          <Field label="Modèle">
            {(id) => <Input id={id} value={model} onChange={(e) => setModel(e.target.value)} />}
          </Field>
        </div>

        <Field label="Numéro de série (confidentiel)">
          {(id) => (
            <Input
              id={id}
              placeholder="Numéro indiqué par le fabricant"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
            />
          )}
        </Field>

        <Field label="Caractéristiques techniques">
          {(id) => (
            <Input
              id={id}
              value={specifications}
              onChange={(e) => setSpecifications(e.target.value)}
            />
          )}
        </Field>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" loading={mutation.isPending}>
            Créer la machine & générer QR
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AddRowModal({
  open,
  laboratoryId,
  onClose,
  onSuccess,
}: {
  open: boolean;
  laboratoryId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/labs/${laboratoryId}/rows`, {
        code: code.trim(),
        name: name.trim(),
      }),
    onSuccess: () => onSuccess(),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur de création de rangée'),
  });

  return (
    <Modal open={open} title="Ajouter une rangée au laboratoire" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
        className="space-y-4"
      >
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Code de la rangée" hint="Ex: R01, R02, RX, FOND..." required>
          {(id) => (
            <Input
              id={id}
              required
              placeholder="Code réel de la rangée"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          )}
        </Field>

        <Field label="Nom complet de la rangée" required>
          {(id) => (
            <Input
              id={id}
              required
              placeholder="Nom officiel de la rangée"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" loading={mutation.isPending}>
            Ajouter la rangée
          </Button>
        </div>
      </form>
    </Modal>
  );
}

