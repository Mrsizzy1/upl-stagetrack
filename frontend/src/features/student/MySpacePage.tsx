import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
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
  PageHeader,
  StatCard,
  TableWrap,
  attendanceTone,
  studentTone,
  tableClass,
  tdClass,
  thClass,
} from '../../components/ui';
import { api, downloadFile, qs } from '../../lib/api';
import { ATTENDANCE_LABELS, formatDate, formatTime, fullName, SESSION_LABELS, STUDENT_STATUS_LABELS } from '../../lib/format';
import { AuthImage, PhotoPlaceholder } from '../../lib/hooks';
import type { StudentDetail, StudentHistory } from '../../lib/types';

/** Espace étudiant : consultation uniquement. Aucun pointage ne peut être créé d'ici. */
export function MySpacePage() {
  const navigate = useNavigate();
  const profile = useQuery({ queryKey: ['me-student'], queryFn: () => api.get<StudentDetail>('/me/student') });
  const [range, setRange] = useState({ from: '', to: '' });
  const history = useQuery({ queryKey: ['me-history', range], queryFn: () => api.get<StudentHistory>(`/me/attendance${qs(range)}`) });
  const [downloadError, setDownloadError] = useState<unknown>(null);

  if (profile.isPending) return <Loading />;
  if (profile.error) return <ErrorAlert error={profile.error} />;
  const s = profile.data;
  const current = s.internships[0];

  return (
    <div>
      <PageHeader
        title="Mon espace"
        description="Votre profil, votre QR Code personnel et l'historique de vos présences."
        actions={
          <Button variant="secondary" onClick={() => navigate('/changer-mot-de-passe')}>
            Changer mon mot de passe
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Mon profil">
          <div className="flex gap-4">
            <AuthImage
              src={s.hasPhoto ? '/me/photo' : null}
              alt="Ma photo"
              className="h-28 w-24 shrink-0 rounded object-cover"
              fallback={<PhotoPlaceholder className="h-28 w-24 shrink-0 rounded" />}
            />
            <dl className="space-y-1 text-sm">
              <dd className="font-semibold">{fullName(s)}</dd>
              <dd>Matricule : {s.matricule}</dd>
              <dd>{s.faculty.name}</dd>
              <dd>
                {s.department.name} · {s.promotion.label}
              </dd>
              <dd>
                <Badge tone={studentTone(s.status)}>{STUDENT_STATUS_LABELS[s.status]}</Badge>
              </dd>
            </dl>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            Stage : {current ? `du ${formatDate(current.startDate)} au ${formatDate(current.endDate)}` : 'aucune période enregistrée'}
          </p>
        </Card>

        <Card title="Mon QR Code">
          {s.activeQrIssuedAt ? (
            <>
              <AuthImage src="/me/qr.png" alt="Mon QR Code de pointage" className="mx-auto h-52 w-52" />
              <p className="mt-2 text-center text-xs text-slate-600">Présentez ce code à l'agent de pointage. Ne le partagez pas.</p>
              <div className="mt-3 flex justify-center">
                <Button variant="secondary" onClick={() => downloadFile('/me/qr.png', `mon-qr-${s.matricule}.png`).catch(setDownloadError)}>
                  Télécharger
                </Button>
              </div>
              <ErrorAlert error={downloadError} />
            </>
          ) : (
            <Alert tone="warning">Vous n'avez pas de QR Code actif. Adressez-vous à l'administration.</Alert>
          )}
        </Card>

        <div className="grid content-start gap-3">
          {history.data && (
            <>
              <StatCard label="Présences" value={history.data.stats.present} tone="green" />
              <StatCard label="Retards" value={history.data.stats.late} tone="amber" />
              <StatCard label="Absences" value={history.data.stats.absent} tone="red" />
              <StatCard label="Taux de présence" value={history.data.stats.rate === null ? '—' : `${history.data.stats.rate} %`} />
            </>
          )}
        </div>
      </div>

      <Card title="Mon historique" className="mt-6">
        <div className="mb-4 flex flex-wrap gap-3">
          <Field label="Du">{(id) => <Input id={id} type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />}</Field>
          <Field label="Au">{(id) => <Input id={id} type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />}</Field>
        </div>
        {history.isPending && <Loading />}
        <ErrorAlert error={history.error} />
        {history.data && history.data.items.length === 0 && <Empty>Aucun pointage sur cette période.</Empty>}
        {history.data && history.data.items.length > 0 && (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Session</th>
                  <th className={thClass}>Statut</th>
                  <th className={thClass}>Heure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {history.data.items.map((r) => (
                  <tr key={r.id}>
                    <td className={tdClass}>{formatDate(r.date)}</td>
                    <td className={tdClass}>{SESSION_LABELS[r.sessionType]}</td>
                    <td className={tdClass}>
                      <Badge tone={attendanceTone(r.status)}>{ATTENDANCE_LABELS[r.status]}</Badge>
                      {r.isCorrected && <span className="ml-2 text-xs text-slate-600">corrigé par l'administration</span>}
                    </td>
                    <td className={`${tdClass} tabular-nums`}>{formatTime(r.recordedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
