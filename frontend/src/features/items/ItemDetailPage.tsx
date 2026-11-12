import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router';
import { UPLLogo } from '../../components/UPLLogo';
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
  Textarea,
} from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDate, ITEM_CATEGORY_LABELS, ITEM_TYPE_LABELS } from '../../lib/format';
import type { PublicItemListItem } from '../../lib/types';

export function ItemDetailPage() {
  const { state } = useAuth();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [claimOpen, setClaimOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: item, isLoading, error } = useQuery({
    queryKey: ['public-item', id],
    queryFn: () => api.get<PublicItemListItem>(`/items/public/${id}`),
    enabled: Boolean(id),
  });

  return (
    <div className="min-h-screen bg-slate-50 text-upl-blue-950 flex flex-col">
      <header className="bg-white border-b border-upl-blue-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <UPLLogo size="md" />
            <div className="leading-tight">
              <span className="block font-bold text-base text-upl-blue-900">UPL StageTrack</span>
              <span className="block text-xs text-slate-500">Portail des Objets</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {state.status === 'authenticated' && (
              <Link
                to={['ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN'].includes(state.user.role) ? '/admin/objets' : '/hub'}
                className="text-xs font-semibold text-upl-blue-800 bg-upl-blue-50 px-3 py-1.5 rounded-lg hover:bg-upl-blue-100"
              >
                ← Espace de gestion
              </Link>
            )}
            <Link to="/objets" className="text-sm font-semibold text-upl-blue-700 hover:underline">
              ← Retour au catalogue
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {isLoading ? (
          <Loading label="Chargement de la fiche de l'objet…" />
        ) : error || !item ? (
          <ErrorAlert error={error ?? new Error('Objet introuvable')} />
        ) : (
          <div>
            <PageHeader
              title={item.title}
              description={`Objet publié le ${formatDate(item.createdAt.split('T')[0])}`}
              actions={
                <Button variant="primary" onClick={() => setClaimOpen(true)}>
                  Demander la restitution
                </Button>
              }
            />

            {successMsg && (
              <div className="mb-6">
                <Alert tone="success" title="Demande transmise avec succès">
                  {successMsg}
                </Alert>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Photo */}
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 overflow-hidden flex items-center justify-center min-h-[300px]">
                {item.photoPath ? (
                  <img
                    src={`/api/items/photos/${item.photoPath}`}
                    alt={item.title}
                    className="max-h-[400px] w-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="text-center p-8 text-slate-400">
                    <span className="block text-5xl font-bold mb-2">UPL</span>
                    <span className="text-sm">Aucune photo fournie</span>
                  </div>
                )}
              </div>

              {/* Détails */}
              <Card title="Caractéristiques de l'objet">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-semibold uppercase text-slate-500">Type</span>
                    <Badge tone={item.type === 'LOST' ? 'danger' : 'success'}>
                      {ITEM_TYPE_LABELS[item.type]}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-semibold uppercase text-slate-500">Catégorie</span>
                    <span className="text-sm font-semibold text-upl-blue-900">
                      {ITEM_CATEGORY_LABELS[item.category]}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-semibold uppercase text-slate-500">Date de l'événement</span>
                    <span className="text-sm text-slate-800">{formatDate(item.eventDate)}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-semibold uppercase text-slate-500">Lieu constaté</span>
                    <span className="text-sm font-medium text-slate-900">{item.location}</span>
                  </div>

                  <div className="pt-2">
                    <span className="block text-xs font-semibold uppercase text-slate-500 mb-1">Description</span>
                    <p className="text-sm text-slate-700 whitespace-pre-line bg-slate-50 p-3.5 rounded-lg border border-slate-100 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="pt-4">
                    <Button variant="primary" className="w-full" onClick={() => setClaimOpen(true)}>
                      Cet objet m'appartient (Faire une réclamation)
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>

      {item && (
        <ClaimItemModal
          open={claimOpen}
          itemId={item.id}
          itemTitle={item.title}
          onClose={() => setClaimOpen(false)}
          onSuccess={(msg) => {
            setClaimOpen(false);
            setSuccessMsg(msg);
            void queryClient.invalidateQueries({ queryKey: ['public-item', id] });
          }}
        />
      )}
    </div>
  );
}

function ClaimItemModal({
  open,
  itemId,
  itemTitle,
  onClose,
  onSuccess,
}: {
  open: boolean;
  itemId: string;
  itemTitle: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [claimantName, setClaimantName] = useState('');
  const [claimantPhone, setClaimantPhone] = useState('');
  const [claimantEmail, setClaimantEmail] = useState('');
  const [proofDescription, setProofDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.set('claimantName', claimantName.trim());
      formData.set('claimantPhone', claimantPhone.trim());
      if (claimantEmail.trim()) formData.set('claimantEmail', claimantEmail.trim());
      formData.set('proofDescription', proofDescription.trim());
      if (file) formData.set('photo', file);

      return api.upload<{ message: string }>(`/items/public/${itemId}/claim`, formData);
    },
    onSuccess: (res) => {
      onSuccess(res.message);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue lors de la transmission.');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  return (
    <Modal open={open} title={`Réclamer : ${itemTitle}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <p className="text-xs text-slate-600">
          Afin d'éviter toute usurpation, veuillez décrire des éléments distinctifs précis prouvant que vous êtes le
          légitime propriétaire (numéro de série, contenu d'un dossier, éraflure particulière, facture ou photo ancienne).
        </p>

        <Field label="Votre nom complet" required>
          {(id) => (
            <Input
              id={id}
              required
              minLength={2}
              value={claimantName}
              onChange={(e) => setClaimantName(e.target.value)}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Numéro de téléphone" required>
            {(id) => (
              <Input
                id={id}
                required
                minLength={5}
                value={claimantPhone}
                onChange={(e) => setClaimantPhone(e.target.value)}
              />
            )}
          </Field>
          <Field label="Adresse électronique">
            {(id) => (
              <Input
                id={id}
                type="email"
                value={claimantEmail}
                onChange={(e) => setClaimantEmail(e.target.value)}
              />
            )}
          </Field>
        </div>

        <Field label="Preuve de propriété détaillée" hint="Détails non visibles sur les photos publiques..." required>
          {(id) => (
            <Textarea
              id={id}
              required
              minLength={10}
              rows={4}
              placeholder="Ex: Le mot de passe de session commence par..., il y a une rayure sous la coque droite..."
              value={proofDescription}
              onChange={(e) => setProofDescription(e.target.value)}
            />
          )}
        </Field>

        <Field label="Document ou photo de preuve (optionnel)" hint="Facture d'achat, capture d'écran, boîte d'origine...">
          {() => (
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-upl-blue-50 file:text-upl-blue-700 hover:file:bg-upl-blue-100"
            />
          )}
        </Field>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" loading={mutation.isPending}>
            Transmettre la réclamation
          </Button>
        </div>
      </form>
    </Modal>
  );
}

