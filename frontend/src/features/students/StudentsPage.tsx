import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorAlert,
  Field,
  Input,
  Loading,
  PageHeader,
  Pagination,
  Select,
  TableWrap,
  studentTone,
  tableClass,
  tdClass,
  thClass,
} from '../../components/ui';
import { api, qs } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { formatDate, fullName, STUDENT_STATUS_LABELS } from '../../lib/format';
import { useReference } from '../../lib/hooks';
import type { Paginated, StudentListItem } from '../../lib/types';

export function StudentsPage() {
  const user = useUser();
  const navigate = useNavigate();
  const reference = useReference();
  const [filters, setFilters] = useState({ search: '', facultyId: '', departmentId: '', promotionId: '', status: '' });
  const [page, setPage] = useState(1);
  const set = (k: keyof typeof filters) => (e: { target: { value: string } }) => {
    setFilters((f) => ({ ...f, [k]: e.target.value, ...(k === 'facultyId' ? { departmentId: '' } : {}) }));
    setPage(1);
  };
  const departments = reference.data?.faculties.find((f) => f.id === filters.facultyId)?.departments ?? [];

  const list = useQuery({
    queryKey: ['students', filters, page],
    queryFn: () => api.get<Paginated<StudentListItem>>(`/students${qs({ ...filters, page, pageSize: 25 })}`),
  });

  return (
    <div>
      <PageHeader
        title="Étudiants"
        description="Stagiaires inscrits, recherche par matricule ou par nom."
        actions={
          user.role === 'ADMIN' && (
            <>
              <Button variant="secondary" onClick={() => navigate('/import')}>
                Importer
              </Button>
              <Button onClick={() => navigate('/etudiants/nouveau')}>Ajouter un étudiant</Button>
            </>
          )
        }
      />
      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Recherche">{(id) => <Input id={id} placeholder="Matricule, nom, postnom…" value={filters.search} onChange={set('search')} />}</Field>
          <Field label="Faculté">
            {(id) => (
              <Select id={id} value={filters.facultyId} onChange={set('facultyId')}>
                <option value="">Toutes</option>
                {reference.data?.faculties.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Département">
            {(id) => (
              <Select id={id} value={filters.departmentId} onChange={set('departmentId')} disabled={!filters.facultyId}>
                <option value="">Tous</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Promotion">
            {(id) => (
              <Select id={id} value={filters.promotionId} onChange={set('promotionId')}>
                <option value="">Toutes</option>
                {reference.data?.promotions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Statut">
            {(id) => (
              <Select id={id} value={filters.status} onChange={set('status')}>
                <option value="">Tous</option>
                <option value="ACTIVE">Actif</option>
                <option value="SUSPENDED">Suspendu</option>
                <option value="COMPLETED">Terminé</option>
              </Select>
            )}
          </Field>
        </div>
      </Card>

      <Card>
        {list.isPending && <Loading />}
        <ErrorAlert error={list.error} />
        {list.data && list.data.items.length === 0 && (
          <Empty>
            Aucun étudiant trouvé.
            {user.role === 'ADMIN' && reference.data?.faculties.length === 0 && ' Commencez par créer les facultés dans le Référentiel.'}
          </Empty>
        )}
        {list.data && list.data.items.length > 0 && (
          <>
            <TableWrap>
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Matricule</th>
                    <th className={thClass}>Nom complet</th>
                    <th className={thClass}>Faculté / Département</th>
                    <th className={thClass}>Promotion</th>
                    <th className={thClass}>Stage</th>
                    <th className={thClass}>Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-upl-blue-100">
                  {list.data.items.map((s) => (
                    <tr key={s.id} className="hover:bg-upl-blue-50">
                      <td className={`${tdClass} font-mono text-xs`}>{s.matricule}</td>
                      <td className={tdClass}>
                        <Link to={`/etudiants/${s.id}`} className="font-medium text-upl-blue-900 hover:underline">
                          {fullName(s)}
                        </Link>
                      </td>
                      <td className={tdClass}>
                        {s.faculty.code}
                        <div className="text-xs text-upl-blue-800">{s.department.name}</div>
                      </td>
                      <td className={tdClass}>{s.promotion.label}</td>
                      <td className={`${tdClass} text-xs`}>
                        {s.currentInternship ? `${formatDate(s.currentInternship.startDate)} → ${formatDate(s.currentInternship.endDate)}` : '—'}
                      </td>
                      <td className={tdClass}>
                        <Badge tone={studentTone(s.status)}>{STUDENT_STATUS_LABELS[s.status]}</Badge>
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
    </div>
  );
}
