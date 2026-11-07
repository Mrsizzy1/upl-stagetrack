import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Badge,
  Card,
  Empty,
  ErrorAlert,
  Field,
  Input,
  Loading,
  PageHeader,
  Select,
  StatCard,
  TableWrap,
  attendanceTone,
  tableClass,
  tdClass,
  thClass,
} from '../../components/ui';
import { api, qs } from '../../lib/api';
import { ATTENDANCE_LABELS, formatDate, formatTime, METHOD_LABELS, SESSION_LABELS, todayInLubumbashi } from '../../lib/format';
import { useReference } from '../../lib/hooks';
import type { AttendanceStatus, SessionType } from '../../lib/types';

interface SessionSummary {
  state: 'OPEN' | 'CLOSED' | 'NOT_STARTED';
  present: number;
  late: number;
  absent: number;
}
interface Dashboard {
  date: string;
  totalStudents: number;
  morning: SessionSummary;
  evening: SessionSummary;
  absent: number;
  late: number;
  rate: number | null;
  recent: {
    id: string;
    sessionType: SessionType;
    status: AttendanceStatus;
    recordedAt: string;
    method: 'QR' | 'MANUAL';
    student: { id: string; matricule: string; lastName: string; middleName: string; firstName: string; faculty: { code: string } };
  }[];
  trend: { date: string; present: number; late: number; absent: number; rate: number | null }[];
}

// Couleurs d'état (validées : séparation daltonisme ≥ 16 ΔE). Légende et tableau accompagnent toujours la couleur.
// Présent : vert (sémantique) ; retard : or du logo UPL ; absent : rouge UPL assombri pour la lisibilité.
const COLORS = { present: '#2E8B57', late: '#F9B233', absent: '#B80D0D' };

const sessionHint = (s: SessionSummary) =>
  s.state === 'CLOSED' ? `${s.late} en retard · ${s.absent} absent(s)` : s.state === 'OPEN' ? 'Session en cours' : 'Pas encore commencée';

export function DashboardPage() {
  const reference = useReference();
  const [filters, setFilters] = useState({ date: todayInLubumbashi(), facultyId: '', departmentId: '', promotionId: '' });
  const set = (k: keyof typeof filters) => (e: { target: { value: string } }) =>
    setFilters((f) => ({ ...f, [k]: e.target.value, ...(k === 'facultyId' ? { departmentId: '' } : {}) }));
  const departments = reference.data?.faculties.find((f) => f.id === filters.facultyId)?.departments ?? [];

  const dashboard = useQuery({
    queryKey: ['dashboard', filters],
    queryFn: () => api.get<Dashboard>(`/dashboard${qs(filters)}`),
    refetchInterval: 30_000,
  });
  const d = dashboard.data;
  const chartData = d?.trend.map((t) => ({ ...t, label: formatDate(t.date).slice(0, 5) })) ?? [];
  const hasTrend = chartData.some((t) => t.present + t.late + t.absent > 0);

  return (
    <div>
      <PageHeader title="Tableau de bord" description="Chiffres calculés en direct à partir des pointages enregistrés." />
      <div className="mb-6 grid gap-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-upl-blue-100 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Date">{(id) => <Input id={id} type="date" value={filters.date} onChange={set('date')} />}</Field>
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
              {departments.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
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
      </div>

      {dashboard.isPending && <Loading />}
      <ErrorAlert error={dashboard.error} />
      {d && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <StatCard label="Étudiants actifs" value={d.totalStudents} />
            <StatCard label="Présents le matin" value={d.morning.present} hint={sessionHint(d.morning)} tone="green" />
            <StatCard label="Présents le soir" value={d.evening.present} hint={sessionHint(d.evening)} tone="green" />
            <StatCard label="Absents" value={d.absent} hint="Sessions clôturées" tone="red" />
            <StatCard label="Retards" value={d.late} tone="amber" />
            <StatCard label="Taux de présence" value={d.rate === null ? '—' : `${d.rate} %`} hint={d.rate === null ? 'Après la première clôture' : 'Sessions clôturées du jour'} />
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <Card title="Fréquentation sur 14 jours" className="xl:col-span-3">
              {!hasTrend ? (
                <Empty>Aucun pointage sur les 14 derniers jours.</Empty>
              ) : (
                <>
                  <div className="h-72" role="img" aria-label="Pointages par jour : présents, retards et absents sur 14 jours">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="25%">
                        <CartesianGrid vertical={false} stroke="#e1e5f4" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#2b3a7a' }} tickLine={false} axisLine={{ stroke: '#c5cce8' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#2b3a7a' }} tickLine={false} axisLine={false} />
                        <Tooltip
                          cursor={{ fill: '#f4f6fc' }}
                          formatter={(value: number, name: string) => [value, name]}
                          labelFormatter={(_, payload) => (payload?.[0] ? formatDate(payload[0].payload.date) : '')}
                        />
                        <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="present" name="Présents" stackId="a" fill={COLORS.present} stroke="#fff" strokeWidth={1} />
                        <Bar dataKey="late" name="En retard" stackId="a" fill={COLORS.late} stroke="#fff" strokeWidth={1} />
                        <Bar dataKey="absent" name="Absents" stackId="a" fill={COLORS.absent} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-upl-blue-800">Voir les données en tableau</summary>
                    <TableWrap>
                      <table className={`${tableClass} mt-2`}>
                        <thead>
                          <tr>
                            <th className={thClass}>Jour</th>
                            <th className={`${thClass} text-right`}>Présents</th>
                            <th className={`${thClass} text-right`}>Retards</th>
                            <th className={`${thClass} text-right`}>Absents</th>
                            <th className={`${thClass} text-right`}>Taux</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-upl-blue-100">
                          {d.trend.map((t) => (
                            <tr key={t.date}>
                              <td className={tdClass}>{formatDate(t.date)}</td>
                              <td className={`${tdClass} text-right tabular-nums`}>{t.present}</td>
                              <td className={`${tdClass} text-right tabular-nums`}>{t.late}</td>
                              <td className={`${tdClass} text-right tabular-nums`}>{t.absent}</td>
                              <td className={`${tdClass} text-right tabular-nums`}>{t.rate === null ? '—' : `${t.rate} %`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableWrap>
                  </details>
                </>
              )}
            </Card>

            <Card title="Derniers pointages" className="xl:col-span-2">
              {d.recent.length === 0 ? (
                <Empty>Aucun pointage ce jour-là.</Empty>
              ) : (
                <ul className="divide-y divide-upl-blue-100">
                  {d.recent.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div>
                        <Link to={`/etudiants/${r.student.id}`} className="font-medium text-upl-blue-900 hover:underline">
                          {r.student.lastName.toUpperCase()} {r.student.firstName}
                        </Link>
                        <p className="text-xs text-upl-blue-800">
                          {r.student.matricule} · {r.student.faculty.code} · {SESSION_LABELS[r.sessionType]} · {METHOD_LABELS[r.method]}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="tabular-nums">{formatTime(r.recordedAt)}</p>
                        <Badge tone={attendanceTone(r.status)}>{ATTENDANCE_LABELS[r.status]}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
