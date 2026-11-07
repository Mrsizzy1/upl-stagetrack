import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
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
  StatCard,
  TableWrap,
  attendanceTone,
  tableClass,
  tdClass,
  thClass,
} from '../../components/ui';
import { api, qs } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { ATTENDANCE_LABELS, formatDateTime, formatTime, fullName, METHOD_LABELS, SESSION_LABELS, todayInLubumbashi } from '../../lib/format';
import { useReference } from '../../lib/hooks';
import type { AttendanceRow, Paginated } from '../../lib/types';
import { CorrectionModal } from './CorrectionModal';

interface AttendanceList extends Paginated<AttendanceRow> {
  sessions: {
    sessionType: 'MORNING' | 'EVENING';
    state: 'OPEN' | 'CLOSED';
    closedAt: string | null;
    expectedCount: number | null;
    presentCount: number | null;
    lateCount: number | null;
    absentCount: number | null;
  }[];
}

export function AttendancePage() {
  const user = useUser();
  const reference = useReference();
  const [filters, setFilters] = useState({ date: todayInLubumbashi(), sessionType: '', status: '', facultyId: '', search: '' });
  const [page, setPage] = useState(1);
  const [correcting, setCorrecting] = useState<AttendanceRow | null>(null);
  const set = (k: keyof typeof filters) => (e: { target: { value: string } }) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setPage(1);
  };

  const list = useQuery({
    queryKey: ['attendance', filters, page],
    queryFn: () => api.get<AttendanceList>(`/attendance${qs({ ...filters, page, pageSize: 50 })}`),
    enabled: Boolean(filters.date),
  });

  return (
    <div>
      <PageHeader title="Présences" description="Pointages et absences par jour. Les absences apparaissent à la clôture de chaque session." />

      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Date">{(id) => <Input id={id} type="date" value={filters.date} onChange={set('date')} />}</Field>
          <Field label="Session">
            {(id) => (
              <Select id={id} value={filters.sessionType} onChange={set('sessionType')}>
                <option value="">Toutes</option>
                <option value="MORNING">Matin</option>
                <option value="EVENING">Soir</option>
              </Select>
            )}
          </Field>
          <Field label="Statut">
            {(id) => (
              <Select id={id} value={filters.status} onChange={set('status')}>
                <option value="">Tous</option>
                <option value="PRESENT">Présent</option>
                <option value="LATE">En retard</option>
                <option value="ABSENT">Absent</option>
              </Select>
            )}
          </Field>
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
          <Field label="Recherche">{(id) => <Input id={id} placeholder="Nom ou matricule" value={filters.search} onChange={set('search')} />}</Field>
        </div>
      </Card>

      {list.data && list.data.sessions.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {list.data.sessions.map((s) => (
            <StatCard
              key={s.sessionType}
              label={`Session du ${SESSION_LABELS[s.sessionType].toLowerCase()}`}
              value={s.state === 'CLOSED' ? `${(s.presentCount ?? 0) + (s.lateCount ?? 0)} / ${s.expectedCount ?? 0}` : 'En cours'}
              hint={
                s.state === 'CLOSED'
                  ? `Clôturée à ${formatTime(s.closedAt)} · ${s.lateCount ?? 0} retard(s) · ${s.absentCount ?? 0} absent(s)`
                  : 'Les absences seront calculées à la fermeture'
              }
              tone={s.state === 'CLOSED' ? 'green' : undefined}
            />
          ))}
        </div>
      )}

      <Card>
        {list.isPending && <Loading />}
        <ErrorAlert error={list.error} />
        {list.data && list.data.items.length === 0 && <Empty>Aucun pointage pour ces critères.</Empty>}
        {list.data && list.data.items.length > 0 && (
          <>
            <TableWrap>
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Étudiant</th>
                    <th className={thClass}>Faculté</th>
                    <th className={thClass}>Session</th>
                    <th className={thClass}>Statut</th>
                    <th className={thClass}>Heure</th>
                    <th className={thClass}>Mode</th>
                    {user.role === 'ADMIN' && <th className={thClass}><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-upl-blue-100">
                  {list.data.items.map((row) => (
                    <tr key={row.id}>
                      <td className={tdClass}>
                        <Link to={`/etudiants/${row.student.id}`} className="font-medium text-upl-blue-900 hover:underline">
                          {fullName(row.student)}
                        </Link>
                        <div className="text-xs text-upl-blue-800">{row.student.matricule}</div>
                      </td>
                      <td className={tdClass}>{row.student.faculty.code}</td>
                      <td className={tdClass}>{SESSION_LABELS[row.sessionType]}</td>
                      <td className={tdClass}>
                        <Badge tone={attendanceTone(row.status)}>{ATTENDANCE_LABELS[row.status]}</Badge>
                        {row.isCorrected && (
                          <div className="mt-1 text-xs text-upl-blue-800" title={row.corrections[0]?.reason}>
                            Corrigé le {formatDateTime(row.corrections[0]?.createdAt)} par {row.corrections[0]?.correctedBy.fullName}
                          </div>
                        )}
                      </td>
                      <td className={`${tdClass} tabular-nums`}>{formatTime(row.recordedAt)}</td>
                      <td className={tdClass}>
                        {METHOD_LABELS[row.method]}
                        {row.manualReason && <div className="text-xs text-upl-blue-800">Motif : {row.manualReason}</div>}
                      </td>
                      {user.role === 'ADMIN' && (
                        <td className={`${tdClass} text-right`}>
                          <Button variant="ghost" onClick={() => setCorrecting(row)}>
                            Corriger
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <Pagination page={page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
          </>
        )}
      </Card>
      <CorrectionModal row={correcting} onClose={() => setCorrecting(null)} />
    </div>
  );
}
