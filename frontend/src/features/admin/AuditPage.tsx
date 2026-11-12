import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Card, Empty, ErrorAlert, Field, Input, Loading, PageHeader, Pagination, Select, TableWrap, tableClass, tdClass, thClass } from '../../components/ui';
import { api, qs } from '../../lib/api';
import { formatDateTime, SESSION_LABELS } from '../../lib/format';
import type { Paginated, SessionType } from '../../lib/types';

interface LogItem {
  id: string;
  at: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  actor: { fullName: string; username: string } | null;
}
interface ScanItem {
  id: string;
  scannedAt: string;
  method: 'QR' | 'MANUAL';
  result: string;
  sessionType: SessionType | null;
  ip: string | null;
  userAgent: string | null;
  agent: { fullName: string } | null;
  student: { matricule: string; lastName: string; firstName: string } | null;
}

const RESULTS = [
  'ACCEPTED',
  'ALREADY_RECORDED',
  'INVALID_QR',
  'REVOKED_QR',
  'UNKNOWN_MATRICULE',
  'STUDENT_SUSPENDED',
  'NOT_EXPECTED',
  'TOO_EARLY',
  'SESSION_CLOSED',
  'NO_SESSION',
];

export function AuditPage() {
  const [tab, setTab] = useState<'logs' | 'scans'>('logs');
  return (
    <div>
      <PageHeader title="Journal d'audit" description="Traces en ajout seul : elles ne peuvent être ni modifiées ni supprimées, y compris par un administrateur." />
      <div className="mb-4 flex gap-2" role="tablist">
        {(['logs', 'scans'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${tab === t ? 'bg-upl-blue-900 text-white' : 'bg-white text-upl-blue-900 ring-1 ring-slate-200'}`}
          >
            {t === 'logs' ? 'Actions' : 'Tentatives de scan'}
          </button>
        ))}
      </div>
      {tab === 'logs' ? <Logs /> : <Scans />}
    </div>
  );
}

function Logs() {
  const [f, setF] = useState({ action: '', entityType: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ['audit-logs', f, page],
    queryFn: () => api.get<Paginated<LogItem>>(`/audit/logs${qs({ ...f, page, pageSize: 50 })}`),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
    setPage(1);
  };
  return (
    <Card>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Field label="Action">{(id) => <Input id={id} value={f.action} onChange={set('action')} placeholder="ex. CORRECTED" />}</Field>
        <Field label="Type d'élément">
          {(id) => (
            <Select id={id} value={f.entityType} onChange={set('entityType')}>
              <option value="">Tous</option>
              {['User', 'Student', 'Internship', 'Attendance', 'AttendanceSession', 'AttendanceSchedule', 'NonWorkingDay', 'Faculty', 'Department', 'Promotion'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Du">{(id) => <Input id={id} type="date" value={f.from} onChange={set('from')} />}</Field>
        <Field label="Au">{(id) => <Input id={id} type="date" value={f.to} onChange={set('to')} />}</Field>
      </div>
      {list.isPending && <Loading />}
      <ErrorAlert error={list.error} />
      {list.data && list.data.items.length === 0 && <Empty>Aucune entrée.</Empty>}
      {list.data && list.data.items.length > 0 && (
        <>
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Auteur</th>
                  <th className={thClass}>Action</th>
                  <th className={thClass}>Élément</th>
                  <th className={thClass}>Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {list.data.items.map((l) => (
                  <tr key={l.id}>
                    <td className={`${tdClass} whitespace-nowrap`}>{formatDateTime(l.at)}</td>
                    <td className={tdClass}>{l.actor ? l.actor.fullName : <span className="text-slate-600">Système</span>}</td>
                    <td className={`${tdClass} font-mono text-xs`}>{l.action}</td>
                    <td className={`${tdClass} text-xs`}>
                      {l.entityType}
                      {l.entityId && <div className="font-mono text-slate-600">{l.entityId.slice(0, 8)}…</div>}
                    </td>
                    <td className={`${tdClass} max-w-md text-xs`}>
                      {(l.before !== null || l.after !== null) && (
                        <details>
                          <summary className="cursor-pointer text-slate-600">Voir</summary>
                          <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-upl-blue-50 p-2">
                            {JSON.stringify({ avant: l.before, après: l.after }, null, 2)}
                          </pre>
                        </details>
                      )}
                      {l.ip && <div className="text-slate-600">IP {l.ip}</div>}
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
  );
}

function Scans() {
  const [f, setF] = useState({ result: '', date: '' });
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ['audit-scans', f, page],
    queryFn: () => api.get<Paginated<ScanItem>>(`/audit/scans${qs({ ...f, page, pageSize: 50 })}`),
  });
  return (
    <Card>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label="Résultat">
          {(id) => (
            <Select id={id} value={f.result} onChange={(e) => { setF({ ...f, result: e.target.value }); setPage(1); }}>
              <option value="">Tous</option>
              {RESULTS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Date">{(id) => <Input id={id} type="date" value={f.date} onChange={(e) => { setF({ ...f, date: e.target.value }); setPage(1); }} />}</Field>
      </div>
      {list.isPending && <Loading />}
      <ErrorAlert error={list.error} />
      {list.data && list.data.items.length === 0 && <Empty>Aucune tentative.</Empty>}
      {list.data && list.data.items.length > 0 && (
        <>
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Heure serveur</th>
                  <th className={thClass}>Résultat</th>
                  <th className={thClass}>Étudiant</th>
                  <th className={thClass}>Session</th>
                  <th className={thClass}>Agent</th>
                  <th className={thClass}>Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {list.data.items.map((s) => (
                  <tr key={s.id}>
                    <td className={`${tdClass} whitespace-nowrap`}>{formatDateTime(s.scannedAt)}</td>
                    <td className={tdClass}>
                      <Badge tone={s.result === 'ACCEPTED' ? 'success' : s.result === 'ALREADY_RECORDED' ? 'neutral' : 'danger'}>{s.result}</Badge>
                    </td>
                    <td className={tdClass}>{s.student ? `${s.student.lastName.toUpperCase()} ${s.student.firstName} (${s.student.matricule})` : '—'}</td>
                    <td className={tdClass}>{s.sessionType ? SESSION_LABELS[s.sessionType] : '—'}</td>
                    <td className={tdClass}>{s.agent?.fullName ?? '—'}</td>
                    <td className={`${tdClass} text-xs`}>
                      {s.method === 'MANUAL' ? 'Manuel' : 'QR'}
                      {s.method === 'MANUAL' && s.userAgent?.includes('motif:') && (
                        <div className="text-slate-600">{s.userAgent.split('motif:')[1]?.trim()}</div>
                      )}
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
  );
}
