import { useQuery } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Button, Card, Empty, ErrorAlert, Field, Input, Loading, PageHeader, Select, TableWrap, tableClass, tdClass, thClass } from '../../components/ui';
import { api, downloadFile, qs } from '../../lib/api';
import { formatDate, todayInLubumbashi } from '../../lib/format';
import { useReference } from '../../lib/hooks';

interface ReportRow {
  key: string;
  label: string;
  present: number;
  late: number;
  absent: number;
  total: number;
  rate: number | null;
}
interface Report {
  title: string;
  from: string;
  to: string;
  filters: string[];
  rows: ReportRow[];
  totals: Omit<ReportRow, 'key' | 'label'>;
}

const GROUPS = { student: 'Étudiant', faculty: 'Faculté', promotion: 'Promotion', session: 'Session', day: 'Jour' } as const;

export function ReportsPage() {
  const reference = useReference();
  const [form, setForm] = useState({
    period: 'weekly',
    date: todayInLubumbashi(),
    to: '',
    groupBy: 'faculty',
    sessionType: '',
    facultyId: '',
    promotionId: '',
  });
  const [submitted, setSubmitted] = useState<typeof form | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const params = submitted ? qs({ ...submitted, to: submitted.period === 'custom' ? submitted.to : undefined }) : '';

  const report = useQuery({ queryKey: ['report', params], queryFn: () => api.get<Report>(`/reports${params}`), enabled: Boolean(submitted) });
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<unknown>(null);

  async function exportAs(format: 'xlsx' | 'pdf') {
    setExporting(format);
    setExportError(null);
    try {
      await downloadFile(`/reports/export.${format}${params}`, `rapport-presences-${submitted!.date}.${format}`);
    } catch (e) {
      setExportError(e);
    } finally {
      setExporting(null);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted({ ...form });
  }

  return (
    <div>
      <PageHeader title="Rapports" description="Rapports journaliers, hebdomadaires ou mensuels, regroupés par étudiant, faculté, promotion, session ou jour." />
      <Card className="mb-6">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Période">
            {(id) => (
              <Select id={id} value={form.period} onChange={set('period')}>
                <option value="daily">Journalier</option>
                <option value="weekly">Hebdomadaire (lundi–dimanche)</option>
                <option value="monthly">Mensuel</option>
                <option value="custom">Personnalisée</option>
              </Select>
            )}
          </Field>
          <Field label={form.period === 'custom' ? 'Du' : 'Date de référence'}>
            {(id) => <Input id={id} type="date" value={form.date} onChange={set('date')} required />}
          </Field>
          {form.period === 'custom' && (
            <Field label="Au">{(id) => <Input id={id} type="date" value={form.to} min={form.date} onChange={set('to')} required />}</Field>
          )}
          <Field label="Regrouper par">
            {(id) => (
              <Select id={id} value={form.groupBy} onChange={set('groupBy')}>
                {Object.entries(GROUPS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Session">
            {(id) => (
              <Select id={id} value={form.sessionType} onChange={set('sessionType')}>
                <option value="">Matin et soir</option>
                <option value="MORNING">Matin</option>
                <option value="EVENING">Soir</option>
              </Select>
            )}
          </Field>
          <Field label="Faculté">
            {(id) => (
              <Select id={id} value={form.facultyId} onChange={set('facultyId')}>
                <option value="">Toutes</option>
                {reference.data?.faculties.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Promotion">
            {(id) => (
              <Select id={id} value={form.promotionId} onChange={set('promotionId')}>
                <option value="">Toutes</option>
                {reference.data?.promotions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex items-end">
            <Button type="submit">Afficher le rapport</Button>
          </div>
        </form>
      </Card>

      {report.isFetching && <Loading label="Calcul du rapport…" />}
      <ErrorAlert error={report.error ?? exportError} />
      {report.data && (
        <Card
          title={report.data.title}
          actions={
            <>
              <Button variant="secondary" loading={exporting === 'xlsx'} onClick={() => void exportAs('xlsx')}>
                Exporter Excel
              </Button>
              <Button variant="secondary" loading={exporting === 'pdf'} onClick={() => void exportAs('pdf')}>
                Exporter PDF
              </Button>
            </>
          }
        >
          <p className="mb-3 text-sm text-slate-600">
            Du {formatDate(report.data.from)} au {formatDate(report.data.to)}
            {report.data.filters.length > 0 && ` · ${report.data.filters.join(' · ')}`}
          </p>
          {report.data.rows.length === 0 ? (
            <Empty>Aucun pointage sur cette période.</Empty>
          ) : (
            <TableWrap>
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>{GROUPS[(submitted?.groupBy ?? 'faculty') as keyof typeof GROUPS]}</th>
                    <th className={`${thClass} text-right`}>Présents</th>
                    <th className={`${thClass} text-right`}>Retards</th>
                    <th className={`${thClass} text-right`}>Absents</th>
                    <th className={`${thClass} text-right`}>Total</th>
                    <th className={`${thClass} text-right`}>Taux de présence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {report.data.rows.map((r) => (
                    <tr key={r.key}>
                      <td className={tdClass}>{submitted?.groupBy === 'day' ? formatDate(r.label) : r.label}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{r.present}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{r.late}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{r.absent}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{r.total}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{r.rate === null ? '—' : `${r.rate} %`}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-upl-blue-800 font-semibold">
                  <tr>
                    <td className={tdClass}>Total</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{report.data.totals.present}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{report.data.totals.late}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{report.data.totals.absent}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{report.data.totals.total}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{report.data.totals.rate === null ? '—' : `${report.data.totals.rate} %`}</td>
                  </tr>
                </tfoot>
              </table>
            </TableWrap>
          )}
        </Card>
      )}
    </div>
  );
}
