import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import {
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
  TableWrap,
  tableClass,
  tdClass,
  thClass,
} from '../../components/ui';
import { api, qs } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { formatDateTime, ROLE_LABELS } from '../../lib/format';
import type { Paginated, Role, UserView } from '../../lib/types';

const STAFF: Role[] = [
  'SUPER_ADMIN',
  'FACULTY_ADMIN',
  'ADMIN',
  'INTERNSHIP_MANAGER',
  'SUPERVISOR',
  'SCAN_AGENT',
  'IT_TECHNICIAN',
];

export function UsersPage() {
  const me = useUser();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserView | null>(null);
  const [resetting, setResetting] = useState<UserView | null>(null);

  const list = useQuery({
    queryKey: ['users', search, role, page],
    queryFn: () => api.get<Paginated<UserView>>(`/users${qs({ search, role, page, pageSize: 25 })}`),
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['users'] });

  return (
    <div>
      <PageHeader
        title="Comptes"
        description="Administrateurs, responsables de stage et agents de pointage. Les comptes étudiants se créent depuis la fiche de l'étudiant."
        actions={<Button onClick={() => setCreating(true)}>Nouveau compte</Button>}
      />
      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Recherche">{(id) => <Input id={id} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Nom ou identifiant" />}</Field>
          <Field label="Rôle">
            {(id) => (
              <Select id={id} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
                <option value="">Tous</option>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Card>
      <Card>
        {list.isPending && <Loading />}
        <ErrorAlert error={list.error} />
        {list.data && list.data.items.length === 0 && <Empty>Aucun compte.</Empty>}
        {list.data && list.data.items.length > 0 && (
          <>
            <TableWrap>
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Nom</th>
                    <th className={thClass}>Identifiant</th>
                    <th className={thClass}>Rôle</th>
                    <th className={thClass}>État</th>
                    <th className={thClass}>Dernière connexion</th>
                    <th className={thClass}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {list.data.items.map((u) => (
                    <tr key={u.id}>
                      <td className={tdClass}>
                        {u.fullName}
                        {u.email && <div className="text-xs text-slate-600">{u.email}</div>}
                      </td>
                      <td className={`${tdClass} font-mono text-xs`}>{u.username}</td>
                      <td className={tdClass}>{ROLE_LABELS[u.role.code]}</td>
                      <td className={tdClass}>
                        {u.isActive ? <Badge tone="success">Actif</Badge> : <Badge tone="danger">Désactivé</Badge>}
                        {u.mustChangePassword && <div className="mt-1 text-xs text-slate-600">Mot de passe provisoire</div>}
                        {u.lockedUntil && new Date(u.lockedUntil) > new Date() && <div className="mt-1 text-xs text-danger-700">Bloqué temporairement</div>}
                      </td>
                      <td className={tdClass}>{formatDateTime(u.lastLoginAt)}</td>
                      <td className={`${tdClass} whitespace-nowrap text-right`}>
                        <Button variant="ghost" onClick={() => setEditing(u)}>
                          Modifier
                        </Button>
                        <Button variant="ghost" onClick={() => setResetting(u)}>
                          Réinitialiser
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <Pagination page={page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
          </>
        )}
      </Card>
      <CreateModal open={creating} onClose={() => setCreating(false)} onDone={refresh} />
      <EditModal user={editing} isSelf={editing?.id === me.id} onClose={() => setEditing(null)} onDone={refresh} />
      <ResetModal user={resetting} onClose={() => setResetting(null)} onDone={refresh} />
    </div>
  );
}

function CreateModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const blank = { username: '', fullName: '', email: '', role: 'SCAN_AGENT', temporaryPassword: '' };
  const [form, setForm] = useState(blank);
  const save = useMutation({
    mutationFn: () => api.post('/users', { ...form, email: form.email || undefined }),
    onSuccess: () => {
      onDone();
      close();
    },
  });
  function close() {
    setForm(blank);
    save.reset();
    onClose();
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }
  return (
    <Modal open={open} title="Nouveau compte" onClose={close}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorAlert error={save.error} />
        <Field label="Nom complet" required>{(id) => <Input id={id} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />}</Field>
        <Field label="Identifiant" hint="3 à 50 lettres, chiffres, points ou tirets" required>
          {(id) => <Input id={id} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required pattern="[a-zA-Z0-9._\-]{3,50}" />}
        </Field>
        <Field label="Adresse e-mail">{(id) => <Input id={id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
        <Field label="Rôle" required>
          {(id) => (
            <Select id={id} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {STAFF.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Mot de passe provisoire" hint="À communiquer à la personne ; changement obligatoire à la première connexion" required>
          {(id) => <Input id={id} autoComplete="off" value={form.temporaryPassword} onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })} required minLength={10} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            Annuler
          </Button>
          <Button type="submit" loading={save.isPending}>
            Créer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditModal({ user, isSelf, onClose, onDone }: { user: UserView | null; isSelf: boolean; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState<{ fullName: string; email: string; role: Role; isActive: boolean } | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (user && loadedFor !== user.id) {
    setLoadedFor(user.id);
    setForm({ fullName: user.fullName, email: user.email ?? '', role: user.role.code, isActive: user.isActive });
  }
  const save = useMutation({
    mutationFn: () =>
      api.patch(`/users/${user!.id}`, {
        fullName: form!.fullName,
        email: form!.email,
        isActive: form!.isActive,
        ...(user!.role.code !== 'STUDENT' ? { role: form!.role } : {}),
      }),
    onSuccess: () => {
      onDone();
      close();
    },
  });
  function close() {
    setLoadedFor(null);
    save.reset();
    onClose();
  }
  return (
    <Modal open={user !== null} title="Modifier le compte" onClose={close}>
      {form && user && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <ErrorAlert error={save.error} />
          <Field label="Nom complet" required>{(id) => <Input id={id} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />}</Field>
          <Field label="Adresse e-mail">{(id) => <Input id={id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
          {user.role.code !== 'STUDENT' && (
            <Field label="Rôle">
              {(id) => (
                <Select id={id} value={form.role} disabled={isSelf} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                  {STAFF.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} disabled={isSelf} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Compte actif {isSelf && '(vous ne pouvez pas désactiver votre propre compte)'}
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Annuler
            </Button>
            <Button type="submit" loading={save.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ResetModal({ user, onClose, onDone }: { user: UserView | null; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const save = useMutation({
    mutationFn: () => api.post(`/users/${user!.id}/reset-password`, { temporaryPassword: password }),
    onSuccess: () => {
      onDone();
      close();
    },
  });
  function close() {
    setPassword('');
    save.reset();
    onClose();
  }
  return (
    <Modal
      open={user !== null}
      title="Réinitialiser le mot de passe"
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Annuler
          </Button>
          <Button loading={save.isPending} disabled={password.length < 10} onClick={() => save.mutate()}>
            Réinitialiser
          </Button>
        </>
      }
    >
      <p className="text-sm">
        Compte <strong>{user?.fullName}</strong> : ses sessions ouvertes seront fermées et le blocage éventuel levé.
      </p>
      <ErrorAlert error={save.error} />
      <Field label="Nouveau mot de passe provisoire" required>
        {(id) => <Input id={id} autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} />}
      </Field>
    </Modal>
  );
}
