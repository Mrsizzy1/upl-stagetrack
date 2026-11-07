import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Alert, Button, Card, ErrorAlert, Field, Input, Loading, PageHeader, Select } from '../../components/ui';
import { api } from '../../lib/api';
import { useReference } from '../../lib/hooks';
import type { StudentDetail } from '../../lib/types';

const empty = {
  matricule: '',
  lastName: '',
  middleName: '',
  firstName: '',
  facultyId: '',
  departmentId: '',
  promotionId: '',
  email: '',
  phone: '',
  enrolledAt: '',
  startDate: '',
  endDate: '',
  hostService: '',
};

export function StudentFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reference = useReference();
  const [form, setForm] = useState(empty);
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value, ...(k === 'facultyId' ? { departmentId: '' } : {}) }));

  const existing = useQuery({ queryKey: ['student', id], queryFn: () => api.get<StudentDetail>(`/students/${id}`), enabled: editing });
  useEffect(() => {
    const s = existing.data;
    if (!s) return;
    setForm({
      ...empty,
      matricule: s.matricule,
      lastName: s.lastName,
      middleName: s.middleName,
      firstName: s.firstName,
      facultyId: s.faculty.id,
      departmentId: s.department.id,
      promotionId: s.promotion.id,
      email: s.email ?? '',
      phone: s.phone ?? '',
      enrolledAt: s.enrolledAt,
    });
  }, [existing.data]);

  const save = useMutation({
    mutationFn: () => {
      const common = {
        lastName: form.lastName,
        middleName: form.middleName,
        firstName: form.firstName,
        facultyId: form.facultyId,
        departmentId: form.departmentId,
        promotionId: form.promotionId,
        email: form.email,
        phone: form.phone,
        enrolledAt: form.enrolledAt,
      };
      if (editing) {
        // Le matricule n'est envoyé que s'il a été corrigé (l'identifiant de connexion de l'étudiant suit).
        const matriculeChanged = form.matricule.trim().toUpperCase() !== existing.data?.matricule;
        return api.patch<StudentDetail>(`/students/${id}`, { ...common, ...(matriculeChanged ? { matricule: form.matricule } : {}) });
      }
      return api.post<StudentDetail>('/students', {
        ...common,
        matricule: form.matricule,
        internship: form.startDate ? { startDate: form.startDate, endDate: form.endDate, hostService: form.hostService } : undefined,
      });
    },
    onSuccess: (student) => {
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      void queryClient.invalidateQueries({ queryKey: ['student', student.id] });
      navigate(`/etudiants/${student.id}`);
    },
  });

  if (editing && existing.isPending) return <Loading />;
  const departments = reference.data?.faculties.find((f) => f.id === form.facultyId)?.departments ?? [];

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title={editing ? 'Modifier un étudiant' : 'Ajouter un étudiant'} description={editing ? undefined : 'Un QR Code personnel est généré automatiquement.'} />
      {reference.data && reference.data.faculties.length === 0 && (
        <div className="mb-4">
          <Alert tone="warning">Aucune faculté n'est enregistrée : créez d'abord le référentiel (facultés, départements, promotions).</Alert>
        </div>
      )}
      <form onSubmit={submit} className="space-y-6">
        <ErrorAlert error={save.error ?? existing.error} />
        <Card title="Identité">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Matricule"
              required
              hint={editing ? "Modifiable pour corriger une erreur de saisie : l'identifiant de connexion de l'étudiant change aussi." : undefined}
            >
              {(fid) => <Input id={fid} value={form.matricule} onChange={set('matricule')} required maxLength={30} />}
            </Field>
            <div />
            <Field label="Nom" required>
              {(fid) => <Input id={fid} value={form.lastName} onChange={set('lastName')} required maxLength={80} />}
            </Field>
            <Field label="Postnom" required>
              {(fid) => <Input id={fid} value={form.middleName} onChange={set('middleName')} required maxLength={80} />}
            </Field>
            <Field label="Prénom" required>
              {(fid) => <Input id={fid} value={form.firstName} onChange={set('firstName')} required maxLength={80} />}
            </Field>
            <Field label="Date d'inscription" required>
              {(fid) => <Input id={fid} type="date" value={form.enrolledAt} onChange={set('enrolledAt')} required />}
            </Field>
            <Field label="Adresse e-mail">{(fid) => <Input id={fid} type="email" value={form.email} onChange={set('email')} />}</Field>
            <Field label="Téléphone">{(fid) => <Input id={fid} type="tel" value={form.phone} onChange={set('phone')} placeholder="+243 …" />}</Field>
          </div>
        </Card>

        <Card title="Rattachement">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Faculté" required>
              {(fid) => (
                <Select id={fid} value={form.facultyId} onChange={set('facultyId')} required>
                  <option value="">Choisir…</option>
                  {reference.data?.faculties.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Département" required>
              {(fid) => (
                <Select id={fid} value={form.departmentId} onChange={set('departmentId')} required disabled={!form.facultyId}>
                  <option value="">Choisir…</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Promotion" required>
              {(fid) => (
                <Select id={fid} value={form.promotionId} onChange={set('promotionId')} required>
                  <option value="">Choisir…</option>
                  {reference.data?.promotions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Card>

        {!editing && (
          <Card title="Période de stage">
            <p className="mb-3 text-sm text-upl-blue-800">Facultative ici : sans période de stage, l'étudiant n'est attendu à aucun pointage.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Début">{(fid) => <Input id={fid} type="date" value={form.startDate} onChange={set('startDate')} required={Boolean(form.endDate)} />}</Field>
              <Field label="Fin">{(fid) => <Input id={fid} type="date" value={form.endDate} onChange={set('endDate')} required={Boolean(form.startDate)} min={form.startDate} />}</Field>
              <Field label="Service d'accueil">{(fid) => <Input id={fid} value={form.hostService} onChange={set('hostService')} maxLength={150} />}</Field>
            </div>
          </Card>
        )}

        <div className="flex gap-2">
          <Button type="submit" loading={save.isPending}>
            Enregistrer
          </Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Annuler
          </Button>
        </div>
      </form>
    </div>
  );
}
