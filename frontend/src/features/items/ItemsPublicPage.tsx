import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { UPLLogo } from '../../components/UPLLogo';
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
  Textarea,
} from '../../components/ui';
import { api, ApiError, qs } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDate, ITEM_CATEGORY_LABELS, ITEM_TYPE_LABELS } from '../../lib/format';
import type { ItemCategory, ItemType, Paginated, PublicItemListItem } from '../../lib/types';

export function ItemsPublicPage() {
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<ItemType | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [declareOpen, setDeclareOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const queryParams = qs({
    type: typeFilter || undefined,
    category: categoryFilter || undefined,
    q: search.trim() || undefined,
    page,
    pageSize: 18,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-items', queryParams],
    queryFn: () => api.get<Paginated<PublicItemListItem>>(`/items/public${queryParams}`),
  });

  return (
    <div className="min-h-screen bg-slate-50 text-upl-blue-950 flex flex-col">
      {/* En-tête public spécifique */}
      <header className="bg-white border-b border-upl-blue-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <UPLLogo size="md" />
            <div className="leading-tight">
              <span className="block font-bold text-base text-upl-blue-900">UPL StageTrack</span>
              <span className="block text-xs text-slate-500">Portail des Objets Perdus & Retrouvés</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {state.status === 'authenticated' ? (
              <>
                <Link
                  to={['ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN'].includes(state.user.role) ? '/admin/objets' : '/hub'}
                  className="text-xs font-semibold text-upl-blue-800 bg-upl-blue-50 px-3 py-1.5 rounded-lg hover:bg-upl-blue-100"
                >
                  ← Retour à mon espace ({state.user.username})
                </Link>
                {['ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN'].includes(state.user.role) && (
                  <Link
                    to="/admin/objets"
                    className="text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100"
                  >
                    Espace modération
                  </Link>
                )}
              </>
            ) : (
              <Link to="/" className="text-sm font-semibold text-upl-blue-700 hover:underline">
                ← Retour à l'accueil
              </Link>
            )}
            <Button variant="primary" onClick={() => setDeclareOpen(true)}>
              + Déclarer un objet
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <PageHeader
          title="Objets perdus et retrouvés"
          description="Consultez les objets déclarés égarés ou retrouvés au sein de la faculté. Vous pouvez rechercher un objet ou soumettre une déclaration en cas de perte ou de découverte."
          actions={
            <Button variant="primary" onClick={() => setDeclareOpen(true)}>
              + Déclarer un objet
            </Button>
          }
        />

        {successMsg && (
          <div className="mb-6">
            <Alert tone="success" title="Déclaration enregistrée">
              {successMsg}
            </Alert>
          </div>
        )}

        {/* Filtres de recherche */}
        <Card className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Type d'annonce</label>
              <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as any); setPage(1); }}>
                <option value="">Tous les types</option>
                <option value="LOST">Objets perdus</option>
                <option value="FOUND">Objets retrouvés</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Catégorie</label>
              <Select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value as any); setPage(1); }}>
                <option value="">Toutes les catégories</option>
                {Object.entries(ITEM_CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Recherche par mot-clé ou lieu</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Clé USB, Sac noir, Salle 104..."
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

        {/* Liste des résultats */}
        {isLoading ? (
          <Loading label="Chargement des objets publiés…" />
        ) : error ? (
          <ErrorAlert error={error} />
        ) : !data || data.items.length === 0 ? (
          <Card>
            <Empty>
              Aucun objet ne correspond à vos critères de recherche.
              <div className="mt-3">
                <Button variant="secondary" onClick={() => { setTypeFilter(''); setCategoryFilter(''); setSearch(''); setPage(1); }}>
                  Réinitialiser les filtres
                </Button>
              </div>
            </Empty>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-xs ring-1 ring-slate-200 overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="relative aspect-video bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100">
                    {item.photoPath ? (
                      <img
                        src={`/api/items/photos/${item.photoPath}`}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-4xl text-slate-300 font-bold">UPL</span>
                    )}
                    <div className="absolute top-3 left-3">
                      <Badge tone={item.type === 'LOST' ? 'danger' : 'success'}>
                        {ITEM_TYPE_LABELS[item.type]}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-2">
                      <span className="font-semibold text-upl-blue-700">
                        {ITEM_CATEGORY_LABELS[item.category]}
                      </span>
                      <span>Le {formatDate(item.eventDate)}</span>
                    </div>

                    <h3 className="font-bold text-base text-upl-blue-950 line-clamp-1">{item.title}</h3>
                    <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>Lieu : <strong className="text-slate-700">{item.location}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0">
                  <Link
                    to={`/objets/${item.id}`}
                    className="w-full inline-flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs font-semibold text-upl-blue-900 hover:bg-upl-blue-50 hover:border-upl-blue-200 transition-colors"
                  >
                    Voir les détails & Réclamer →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal de déclaration publique */}
      <DeclareItemModal
        open={declareOpen}
        onClose={() => setDeclareOpen(false)}
        onSuccess={(msg) => {
          setDeclareOpen(false);
          setSuccessMsg(msg);
          void queryClient.invalidateQueries({ queryKey: ['public-items'] });
        }}
      />
    </div>
  );
}

function DeclareItemModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [type, setType] = useState<ItemType>('LOST');
  const [category, setCategory] = useState<ItemCategory>('ELECTRONICS');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.set('type', type);
      formData.set('category', category);
      formData.set('title', title.trim());
      formData.set('description', description.trim());
      formData.set('eventDate', eventDate);
      formData.set('location', location.trim());
      if (contactName.trim()) formData.set('contactName', contactName.trim());
      if (contactPhone.trim()) formData.set('contactPhone', contactPhone.trim());
      if (contactEmail.trim()) formData.set('contactEmail', contactEmail.trim());
      if (file) formData.set('photo', file);

      return api.upload<{ message: string }>('/items/public/declare', formData);
    },
    onSuccess: (res) => {
      onSuccess(res.message);
      setTitle('');
      setDescription('');
      setLocation('');
      setFile(null);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue lors de l’enregistrement');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  return (
    <Modal open={open} title="Déclarer un objet (perdu ou retrouvé)" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type d'annonce">
            {() => (
              <Select value={type} onChange={(e) => setType(e.target.value as any)}>
                <option value="LOST">J'ai perdu un objet</option>
                <option value="FOUND">J'ai retrouvé un objet</option>
              </Select>
            )}
          </Field>

          <Field label="Catégorie">
            {() => (
              <Select value={category} onChange={(e) => setCategory(e.target.value as any)}>
                {Object.entries(ITEM_CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Titre ou nom de l'objet" required>
          {(id) => (
            <Input
              id={id}
              required
              minLength={3}
              placeholder="Ex: Clé USB Kingston 64 Go"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>

        <Field label="Description détaillée" hint="Couleur, marque, signes distinctifs, état..." required>
          {(id) => (
            <Textarea
              id={id}
              required
              minLength={10}
              rows={3}
              placeholder="Décrivez l'objet de manière précise..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
            {(id) => (
              <Input
                id={id}
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            )}
          </Field>

          <Field label="Lieu" hint="Salle, bâtiment..." required>
            {(id) => (
              <Input
                id={id}
                required
                placeholder="Ex: Laboratoire 1, Salle 204"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            )}
          </Field>
        </div>

        <Field label="Photographie de l'objet" hint="Format JPEG, PNG ou WebP (max 5 Mo)">
          {() => (
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-upl-blue-50 file:text-upl-blue-700 hover:file:bg-upl-blue-100"
            />
          )}
        </Field>

        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-700 mb-2">
            Vos coordonnées de contact (confidentielles — masquées sur le portail public)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Votre nom">
              {(id) => <Input id={id} value={contactName} onChange={(e) => setContactName(e.target.value)} />}
            </Field>
            <Field label="Téléphone">
              {(id) => <Input id={id} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />}
            </Field>
          </div>
          <div className="mt-2">
            <Field label="Adresse électronique">
              {(id) => <Input id={id} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />}
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" loading={mutation.isPending}>
            Soumettre la déclaration
          </Button>
        </div>
      </form>
    </Modal>
  );
}

