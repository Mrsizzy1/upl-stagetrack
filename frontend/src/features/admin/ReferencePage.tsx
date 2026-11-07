import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Alert, Button, Card, Empty, ErrorAlert, Field, Input, Loading, Modal, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { useReference } from '../../lib/hooks';

type Target =
  | { kind: 'faculty'; id?: string; code: string; name: string }
  | { kind: 'department'; id?: string; facultyId: string; code: string; name: string }
  | { kind: 'promotion'; id?: string; code: string; label: string; sortOrder: number };

const PATHS = { faculty: 'faculties', department: 'departments', promotion: 'promotions' } as const;

export function ReferencePage() {
  const queryClient = useQueryClient();
  const reference = useReference();
  const [editing, setEditing] = useState<Target | null>(null);
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['reference'] });

  const remove = useMutation({
    mutationFn: (t: { kind: Target['kind']; id: string }) => api.del(`/reference/${PATHS[t.kind]}/${t.id}`),
    onSuccess: invalidate,
  });

  if (reference.isPending) return <Loading />;
  if (reference.error) return <ErrorAlert error={reference.error} />;
  const { faculties, promotions } = reference.data;

  return (
    <div>
      <PageHeader
        title="Référentiel académique"
        description="Liste officielle des facultés, départements et promotions de l'UPL. Les codes servent aussi à l'import des étudiants."
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing({ kind: 'promotion', code: '', label: '', sortOrder: promotions.length + 1 })}>
              Nouvelle promotion
            </Button>
            <Button onClick={() => setEditing({ kind: 'faculty', code: '', name: '' })}>Nouvelle faculté</Button>
          </>
        }
      />
      <ErrorAlert error={remove.error} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {faculties.length === 0 && <Alert tone="info">Aucune faculté enregistrée. Saisissez la liste officielle transmise par l'UPL.</Alert>}
          {faculties.map((f) => (
            <Card
              key={f.id}
              title={`${f.name} (${f.code})`}
              actions={
                <>
                  <Button variant="ghost" onClick={() => setEditing({ kind: 'department', facultyId: f.id, code: '', name: '' })}>
                    Ajouter un département
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing({ kind: 'faculty', id: f.id, code: f.code, name: f.name })}>
                    Modifier
                  </Button>
                  {f.departments.length === 0 && (f._count?.students ?? 0) === 0 && (
                    <Button variant="ghost" onClick={() => remove.mutate({ kind: 'faculty', id: f.id })}>
                      Supprimer
                    </Button>
                  )}
                </>
              }
            >
              {f.departments.length === 0 ? (
                <Empty>Aucun département.</Empty>
              ) : (
                <ul className="divide-y divide-upl-blue-100">
                  {f.departments.map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                      <span>
                        {d.name} <span className="font-mono text-xs text-upl-blue-800">({d.code})</span>
                      </span>
                      <span className="flex gap-1">
                        <Button variant="ghost" onClick={() => setEditing({ kind: 'department', id: d.id, facultyId: f.id, code: d.code, name: d.name })}>
                          Modifier
                        </Button>
                        <Button variant="ghost" onClick={() => remove.mutate({ kind: 'department', id: d.id })}>
                          Supprimer
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-upl-blue-800">{f._count?.students ?? 0} étudiant(s)</p>
            </Card>
          ))}
        </div>
        <Card title="Promotions">
          {promotions.length === 0 ? (
            <Empty>Aucune promotion.</Empty>
          ) : (
            <ul className="divide-y divide-upl-blue-100">
              {promotions.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {p.label} <span className="font-mono text-xs text-upl-blue-800">({p.code})</span>
                  </span>
                  <span className="flex gap-1">
                    <Button variant="ghost" onClick={() => setEditing({ kind: 'promotion', id: p.id, code: p.code, label: p.label, sortOrder: p.sortOrder })}>
                      Modifier
                    </Button>
                    {(p._count?.students ?? 0) === 0 && (
                      <Button variant="ghost" onClick={() => remove.mutate({ kind: 'promotion', id: p.id })}>
                        Supprimer
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <EditModal target={editing} onClose={() => setEditing(null)} onDone={invalidate} />
    </div>
  );
}

function EditModal({ target, onClose, onDone }: { target: Target | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState<Target | null>(null);
  if (target && (!form || form.kind !== target.kind || form.id !== target.id)) setForm(target);
  const save = useMutation({
    mutationFn: () => {
      const { kind, id, ...body } = form!;
      const payload = kind === 'department' && id ? { code: (body as { code: string }).code, name: (body as { name: string }).name } : body;
      return id ? api.patch(`/reference/${PATHS[kind]}/${id}`, payload) : api.post(`/reference/${PATHS[kind]}`, payload);
    },
    onSuccess: () => {
      onDone();
      close();
    },
  });
  function close() {
    setForm(null);
    save.reset();
    onClose();
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }
  const title = !form ? '' : `${form.id ? 'Modifier' : 'Ajouter'} ${form.kind === 'faculty' ? 'une faculté' : form.kind === 'department' ? 'un département' : 'une promotion'}`;
  return (
    <Modal open={target !== null} title={title} onClose={close}>
      {form && (
        <form onSubmit={submit} className="space-y-4">
          <ErrorAlert error={save.error} />
          <Field label="Code" hint="Lettres, chiffres, tirets ; 20 caractères maximum" required>
            {(id) => <Input id={id} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() } as Target)} required maxLength={20} />}
          </Field>
          {form.kind === 'promotion' ? (
            <>
              <Field label="Libellé" required>
                {(id) => <Input id={id} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />}
              </Field>
              <Field label="Ordre d'affichage" required>
                {(id) => <Input id={id} type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} required />}
              </Field>
            </>
          ) : (
            <Field label="Nom" required>
              {(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value } as Target)} required minLength={2} />}
            </Field>
          )}
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
