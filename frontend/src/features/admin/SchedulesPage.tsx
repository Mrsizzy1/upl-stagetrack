import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, ErrorAlert, Field, Input, Loading, PageHeader, TableWrap, tableClass, tdClass, thClass } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDate, SESSION_LABELS, WEEKDAYS } from '../../lib/format';
import type { ScheduleView, SessionType } from '../../lib/types';

interface Overview {
  today: string;
  timeZone: string;
  current: ScheduleView[];
  upcoming: ScheduleView[];
}
interface SessionForm {
  opensAt: string;
  closesAt: string;
  lateAfter: string;
  weekdays: number[];
}

const days = (w: number[]) => WEEKDAYS.filter((d) => w.includes(d.value)).map((d) => d.short).join(', ') || 'aucun';

export function SchedulesPage() {
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ['schedules'], queryFn: () => api.get<Overview>('/schedules') });
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [sessions, setSessions] = useState<Record<SessionType, SessionForm> | null>(null);

  useEffect(() => {
    if (!overview.data || sessions) return;
    const from = (t: SessionType): SessionForm => {
      const c = overview.data.current.find((x) => x.sessionType === t);
      return { opensAt: c?.opensAt ?? '', closesAt: c?.closesAt ?? '', lateAfter: c?.lateAfter ?? '', weekdays: c?.weekdays ?? [1, 2, 3, 4, 5] };
    };
    setSessions({ MORNING: from('MORNING'), EVENING: from('EVENING') });
  }, [overview.data, sessions]);

  const save = useMutation({
    mutationFn: () =>
      api.put<Overview>('/schedules', {
        effectiveFrom,
        morning: { ...sessions!.MORNING, lateAfter: sessions!.MORNING.lateAfter || null },
        evening: { ...sessions!.EVENING, lateAfter: sessions!.EVENING.lateAfter || null },
      }),
    onSuccess: (data) => queryClient.setQueryData(['schedules'], data),
  });
  const cancel = useMutation({
    mutationFn: (date: string) => api.del<Overview>(`/schedules/upcoming/${date}`),
    onSuccess: (data) => queryClient.setQueryData(['schedules'], data),
  });

  if (overview.isPending) return <Loading />;
  if (overview.error) return <ErrorAlert error={overview.error} />;
  const o = overview.data;

  const update = (t: SessionType, patch: Partial<SessionForm>) => setSessions((s) => (s ? { ...s, [t]: { ...s[t], ...patch } } : s));

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <div>
      <PageHeader
        title="Horaires de pointage"
        description={`Fuseau de référence : ${o.timeZone}. Une modification s'applique au plus tôt le lendemain ; l'historique n'est jamais réécrit.`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="En vigueur aujourd'hui">
          {o.current.length === 0 ? (
            <Alert tone="warning">Aucun horaire n'est défini : aucun pointage n'est possible. Lancez le seed ou créez une version.</Alert>
          ) : (
            <ScheduleTable rows={o.current} />
          )}
        </Card>
        <Card title="Versions programmées">
          <ErrorAlert error={cancel.error} />
          {o.upcoming.length === 0 ? (
            <Empty>Aucune modification programmée.</Empty>
          ) : (
            <ScheduleTable rows={o.upcoming} onCancel={(d) => cancel.mutate(d)} />
          )}
        </Card>
      </div>

      {sessions && (
        <Card title="Programmer de nouveaux horaires" className="mt-6">
          <form onSubmit={submit} className="space-y-5">
            <ErrorAlert error={save.error} />
            {save.isSuccess && <Alert tone="success">Nouveaux horaires programmés.</Alert>}
            <Field label="Applicable à partir du" required className="max-w-xs">
              {(id) => <Input id={id} type="date" value={effectiveFrom} min={o.today} onChange={(e) => setEffectiveFrom(e.target.value)} required />}
            </Field>
            <div className="grid gap-6 md:grid-cols-2">
              {(['MORNING', 'EVENING'] as const).map((t) => (
                <fieldset key={t} className="rounded-md border border-upl-blue-100 p-4">
                  <legend className="px-1 text-sm font-semibold text-upl-blue-900">Session du {SESSION_LABELS[t].toLowerCase()}</legend>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Ouverture" required>
                      {(id) => <Input id={id} type="time" value={sessions[t].opensAt} onChange={(e) => update(t, { opensAt: e.target.value })} required />}
                    </Field>
                    <Field label="Fermeture" required hint="minute incluse">
                      {(id) => <Input id={id} type="time" value={sessions[t].closesAt} onChange={(e) => update(t, { closesAt: e.target.value })} required />}
                    </Field>
                    <Field label="Retard après" hint="vide = aucun retard">
                      {(id) => <Input id={id} type="time" value={sessions[t].lateAfter} onChange={(e) => update(t, { lateAfter: e.target.value })} />}
                    </Field>
                  </div>
                  <p className="mb-1 mt-3 text-sm font-medium text-upl-blue-900">Jours</p>
                  <div className="flex flex-wrap gap-3">
                    {WEEKDAYS.map((d) => (
                      <label key={d.value} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={sessions[t].weekdays.includes(d.value)}
                          onChange={(e) =>
                            update(t, {
                              weekdays: e.target.checked
                                ? [...sessions[t].weekdays, d.value].sort()
                                : sessions[t].weekdays.filter((x) => x !== d.value),
                            })
                          }
                        />
                        {d.short}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            <Button type="submit" loading={save.isPending} disabled={!effectiveFrom}>
              Programmer
            </Button>
          </form>
        </Card>
      )}

      <NonWorkingDays today={o.today} />
    </div>
  );
}

function ScheduleTable({ rows, onCancel }: { rows: ScheduleView[]; onCancel?: (date: string) => void }) {
  return (
    <TableWrap>
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>Session</th>
            <th className={thClass}>Fenêtre</th>
            <th className={thClass}>Retard après</th>
            <th className={thClass}>Jours</th>
            <th className={thClass}>Depuis le</th>
            {onCancel && <th className={thClass}><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-upl-blue-100">
          {rows.map((r) => (
            <tr key={`${r.sessionType}-${r.effectiveFrom}`}>
              <td className={tdClass}>{SESSION_LABELS[r.sessionType]}</td>
              <td className={`${tdClass} tabular-nums`}>
                {r.opensAt} – {r.closesAt}
              </td>
              <td className={tdClass}>{r.lateAfter ?? 'Aucun'}</td>
              <td className={tdClass}>{days(r.weekdays)}</td>
              <td className={tdClass}>{formatDate(r.effectiveFrom)}</td>
              {onCancel && (
                <td className={`${tdClass} text-right`}>
                  <Button variant="ghost" onClick={() => onCancel(r.effectiveFrom)}>
                    Annuler
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

function NonWorkingDays({ today }: { today: string }) {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ['non-working-days'],
    queryFn: () => api.get<{ id: string; date: string; label: string; createdBy: string | null }[]>(`/schedules/non-working-days?from=${today}`),
  });
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const add = useMutation({
    mutationFn: () => api.post('/schedules/non-working-days', { date, label }),
    onSuccess: () => {
      setDate('');
      setLabel('');
      void queryClient.invalidateQueries({ queryKey: ['non-working-days'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/schedules/non-working-days/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['non-working-days'] }),
  });
  return (
    <Card title="Jours non travaillés à venir" className="mt-6">
      <p className="mb-3 text-sm text-upl-blue-800">Jours fériés ou congés : aucun scan accepté, aucune absence calculée.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
        className="mb-4 flex flex-wrap items-end gap-3"
      >
        <Field label="Date">{(id) => <Input id={id} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} required />}</Field>
        <Field label="Libellé" className="min-w-64 flex-1">
          {(id) => <Input id={id} value={label} onChange={(e) => setLabel(e.target.value)} required minLength={2} maxLength={120} />}
        </Field>
        <Button type="submit" loading={add.isPending}>
          Ajouter
        </Button>
      </form>
      <ErrorAlert error={add.error ?? remove.error ?? list.error} />
      {list.data && list.data.length === 0 && <Empty>Aucun jour déclaré.</Empty>}
      <ul className="divide-y divide-upl-blue-100">
        {list.data?.map((d) => (
          <li key={d.id} className="flex items-center justify-between py-2 text-sm">
            <span>
              <strong>{formatDate(d.date)}</strong> — {d.label}
            </span>
            <Button variant="ghost" onClick={() => remove.mutate(d.id)}>
              Retirer
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
