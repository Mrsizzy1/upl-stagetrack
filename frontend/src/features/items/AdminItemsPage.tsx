import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { SearchIcon } from '../../components/Icons';
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
  Pagination,
  Select,
  tableClass,
  TableWrap,
  tdClass,
  Textarea,
  thClass,
} from '../../components/ui';
import { api, ApiError, qs } from '../../lib/api';
import {
  formatDate,
  formatDateTime,
  ITEM_CATEGORY_LABELS,
  ITEM_STATUS_LABELS,
  ITEM_TYPE_LABELS,
} from '../../lib/format';
import type { AdminItemListItem, ItemClaimItem, ItemStatus, ItemType, Paginated } from '../../lib/types';

export function AdminItemsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ItemStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<ItemType | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Modales
  const [selectedItem, setSelectedItem] = useState<AdminItemListItem | null>(null);
  const [moderateOpen, setModerateOpen] = useState(false);
  const [claimsOpen, setClaimsOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  const queryParams = qs({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
    q: search.trim() || undefined,
    page,
    pageSize: 15,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-items', queryParams],
    queryFn: () => api.get<Paginated<AdminItemListItem>>(`/items/admin${queryParams}`),
  });

  const statusTone = (s: ItemStatus) => {
    switch (s) {
      case 'PUBLISHED':
        return 'success';
      case 'RETURNED':
        return 'info';
      case 'CLAIM_REQUESTED':
      case 'APPROVED':
        return 'warning';
      case 'REJECTED':
      case 'CLOSED':
        return 'danger';
      case 'PENDING':
      default:
        return 'neutral';
    }
  };

  return (
    <div>
      <PageHeader
        title="Validation des objets perdus"
        description="Vérifiez les signalements d'objets et validez les remises aux propriétaires."
        actions={
          <div className="flex gap-2">
            <Link to="/objets">
              <Button variant="secondary" className="inline-flex items-center gap-1.5">
                <SearchIcon size={16} />
                <span>Voir le catalogue public</span>
              </Button>
            </Link>
          </div>
        }
      />

      <Card className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Filtrer par statut</label>
            <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}>
              <option value="">Tous les statuts</option>
              {Object.entries(ITEM_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Filtrer par type</label>
            <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as any); setPage(1); }}>
              <option value="">Tous les types</option>
              <option value="LOST">Objets perdus</option>
              <option value="FOUND">Objets retrouvés</option>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Recherche</label>
            <div className="flex gap-2">
              <Input
                placeholder="Titre, déclarant, téléphone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setPage(1); }}
              />
              <Button variant="secondary" onClick={() => setPage(1)}>
                Filtrer
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <Loading label="Chargement des déclarations…" />
        ) : error ? (
          <ErrorAlert error={error} />
        ) : !data || data.items.length === 0 ? (
          <Empty>Aucune déclaration trouvée avec ces critères.</Empty>
        ) : (
          <div>
            <TableWrap>
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Objet & Catégorie</th>
                    <th className={thClass}>Type</th>
                    <th className={thClass}>Date & Lieu</th>
                    <th className={thClass}>Statut</th>
                    <th className={thClass}>Déclarant (Privé)</th>
                    <th className={thClass}>Réclamations</th>
                    <th className={thClass}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className={tdClass}>
                        <div className="flex items-center gap-3">
                          {item.photoPath ? (
                            <img
                              src={`/api/items/photos/${item.photoPath}`}
                              alt={item.title}
                              className="h-10 w-10 object-cover rounded-md border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                              UPL
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-upl-blue-900">{item.title}</p>
                            <p className="text-xs text-slate-500">{ITEM_CATEGORY_LABELS[item.category]}</p>
                          </div>
                        </div>
                      </td>
                      <td className={tdClass}>
                        <Badge tone={item.type === 'LOST' ? 'danger' : 'success'}>
                          {ITEM_TYPE_LABELS[item.type]}
                        </Badge>
                      </td>
                      <td className={tdClass}>
                        <p className="text-xs text-slate-800">{formatDate(item.eventDate)}</p>
                        <p className="text-xs text-slate-500">{item.location}</p>
                      </td>
                      <td className={tdClass}>
                        <Badge tone={statusTone(item.status)}>
                          {ITEM_STATUS_LABELS[item.status]}
                        </Badge>
                      </td>
                      <td className={tdClass}>
                        <p className="text-xs font-medium text-slate-800">{item.contactName || 'Anonyme'}</p>
                        {item.contactPhone && <p className="text-xs text-slate-500">{item.contactPhone}</p>}
                        {item.contactEmail && <p className="text-xs text-slate-500">{item.contactEmail}</p>}
                      </td>
                      <td className={tdClass}>
                        <button
                          type="button"
                          onClick={() => { setSelectedItem(item); setClaimsOpen(true); }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-upl-blue-700 hover:underline"
                        >
                          {item._count.claims} réclamation(s)
                        </button>
                      </td>
                      <td className={tdClass}>
                        <div className="flex flex-wrap gap-1.5">
                          {item.status === 'PENDING' && (
                            <Button
                              variant="secondary"
                              className="text-xs py-1 px-2.5"
                              onClick={() => { setSelectedItem(item); setModerateOpen(true); }}
                            >
                              Modérer
                            </Button>
                          )}

                          {item.status !== 'RETURNED' && item.status !== 'CLOSED' && (
                            <Button
                              variant="primary"
                              className="text-xs py-1 px-2.5"
                              onClick={() => { setSelectedItem(item); setReturnOpen(true); }}
                            >
                              Restituer
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>

            <Pagination
              page={page}
              pageSize={15}
              total={data.total}
              onPage={(p) => setPage(p)}
            />
          </div>
        )}
      </Card>

      {/* Modale de modération */}
      {selectedItem && (
        <ModerateModal
          open={moderateOpen}
          item={selectedItem}
          onClose={() => { setModerateOpen(false); setSelectedItem(null); }}
          onSuccess={() => {
            setModerateOpen(false);
            setSelectedItem(null);
            void queryClient.invalidateQueries({ queryKey: ['admin-items'] });
          }}
        />
      )}

      {/* Modale des réclamations */}
      {selectedItem && (
        <ClaimsModal
          open={claimsOpen}
          item={selectedItem}
          onClose={() => { setClaimsOpen(false); setSelectedItem(null); }}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ['admin-items'] });
          }}
        />
      )}

      {/* Modale de restitution */}
      {selectedItem && (
        <ReturnModal
          open={returnOpen}
          item={selectedItem}
          onClose={() => { setReturnOpen(false); setSelectedItem(null); }}
          onSuccess={() => {
            setReturnOpen(false);
            setSelectedItem(null);
            void queryClient.invalidateQueries({ queryKey: ['admin-items'] });
          }}
        />
      )}
    </div>
  );
}

function ModerateModal({
  open,
  item,
  onClose,
  onSuccess,
}: {
  open: boolean;
  item: AdminItemListItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (status: ItemStatus) =>
      api.patch(`/items/admin/${item.id}/status`, {
        status,
        rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
      }),
    onSuccess: () => onSuccess(),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur de mise à jour'),
  });

  return (
    <Modal open={open} title={`Modération : ${item.title}`} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <p className="text-xs text-slate-600">
          Validez la déclaration pour la rendre visible sur le portail public des objets, ou rejetez-la avec un motif.
        </p>

        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-1.5">
          <p><strong>Lieu :</strong> {item.location}</p>
          <p><strong>Date :</strong> {formatDate(item.eventDate)}</p>
          <p><strong>Description :</strong> {item.description}</p>
          <p><strong>Déclarant :</strong> {item.contactName ?? 'Non renseigné'} ({item.contactPhone ?? 'Pas de tél.'})</p>
        </div>

        <Field label="Motif de refus (obligatoire en cas de rejet)">
          {(id) => (
            <Input
              id={id}
              placeholder="Motif factuel de la décision"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          )}
        </Field>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button
            variant="danger"
            onClick={() => mutation.mutate('REJECTED')}
            loading={mutation.isPending}
            disabled={!rejectionReason.trim()}
          >
            Rejeter
          </Button>
          <Button
            variant="primary"
            onClick={() => mutation.mutate('PUBLISHED')}
            loading={mutation.isPending}
          >
            Valider et Publier
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ClaimsModal({
  open,
  item,
  onClose,
  onSuccess,
}: {
  open: boolean;
  item: AdminItemListItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { data: claims, isLoading } = useQuery({
    queryKey: ['item-claims', item.id],
    queryFn: () => api.get<ItemClaimItem[]>(`/items/admin/${item.id}/claims`),
    enabled: open,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ claimId, status }: { claimId: string; status: 'APPROVED' | 'REJECTED' }) =>
      api.post(`/items/admin/claims/${claimId}/review`, { status }),
    onSuccess: () => {
      onSuccess();
    },
  });

  return (
    <Modal open={open} title={`Réclamations pour : ${item.title}`} onClose={onClose}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {isLoading ? (
          <Loading label="Chargement des demandes..." />
        ) : !claims || claims.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">Aucune demande de récupération pour cet objet.</p>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => (
              <div key={claim.id} className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{claim.claimantName}</span>
                  <Badge tone={claim.status === 'APPROVED' ? 'success' : claim.status === 'REJECTED' ? 'danger' : 'warning'}>
                    {claim.status}
                  </Badge>
                </div>

                <p className="text-slate-600">
                  Tél : <strong className="text-slate-800">{claim.claimantPhone}</strong> {claim.claimantEmail && `| ${claim.claimantEmail}`}
                </p>

                <div>
                  <strong className="block text-slate-700">Preuve apportée :</strong>
                  <p className="mt-1 bg-white p-2.5 rounded border border-slate-200 text-slate-800 whitespace-pre-line">
                    {claim.proofDescription}
                  </p>
                </div>

                {claim.proofPhotoPath && (
                  <div className="mt-2">
                    <a
                      href={`/api/items/photos/${claim.proofPhotoPath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-upl-blue-700 font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      Voir la pièce justificative jointe (document)
                    </a>
                  </div>
                )}

                <p className="text-[11px] text-slate-400">Reçue le {formatDateTime(claim.createdAt)}</p>

                {claim.status === 'PENDING' && (
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <Button
                      variant="danger"
                      className="text-xs py-1 px-2.5"
                      onClick={() => reviewMutation.mutate({ claimId: claim.id, status: 'REJECTED' })}
                      loading={reviewMutation.isPending}
                    >
                      Rejeter la preuve
                    </Button>
                    <Button
                      variant="primary"
                      className="text-xs py-1 px-2.5"
                      onClick={() => reviewMutation.mutate({ claimId: claim.id, status: 'APPROVED' })}
                      loading={reviewMutation.isPending}
                    >
                      Approuver la preuve
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ReturnModal({
  open,
  item,
  onClose,
  onSuccess,
}: {
  open: boolean;
  item: AdminItemListItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [returnedToName, setReturnedToName] = useState('');
  const [returnedToIdNumber, setReturnedToIdNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/items/admin/${item.id}/return`, {
        returnedToName: returnedToName.trim(),
        returnedToIdNumber: returnedToIdNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => onSuccess(),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur lors de la restitution'),
  });

  return (
    <Modal open={open} title={`Confirmation de restitution : ${item.title}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
        className="space-y-4"
      >
        {error && <Alert tone="danger">{error}</Alert>}

        <p className="text-xs text-slate-600">
          La confirmation de restitution certifie que l'objet physique a été remis à son bénéficiaire légitime. Cette
          action clôture la procédure et met à jour l'historique officiel.
        </p>

        <Field label="Nom complet du bénéficiaire" required>
          {(id) => (
            <Input
              id={id}
              required
              minLength={2}
              placeholder="Nom complet du déclarant"
              value={returnedToName}
              onChange={(e) => setReturnedToName(e.target.value)}
            />
          )}
        </Field>

        <Field label="Numéro de pièce d'identité ou matricule étudiant" hint="Carte d'étudiant, carte d'électeur, passeport...">
          {(id) => (
            <Input
              id={id}
              placeholder="Référence figurant sur la pièce vérifiée"
              value={returnedToIdNumber}
              onChange={(e) => setReturnedToIdNumber(e.target.value)}
            />
          )}
        </Field>

        <Field label="Observations ou décharge signée">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              placeholder="Description factuelle de la restitution"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </Field>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" loading={mutation.isPending}>
            Confirmer la restitution
          </Button>
        </div>
      </form>
    </Modal>
  );
}

