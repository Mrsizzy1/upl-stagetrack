import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChangeEvent, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
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
  Modal,
  PageHeader,
  Select,
  StatCard,
  TableWrap,
  Textarea,
  attendanceTone,
  studentTone,
  tableClass,
  tdClass,
  thClass,
} from '../../components/ui';
import { api, downloadFile, openFile } from '../../lib/api';
import { useUser } from '../../lib/auth';
import {
  ATTENDANCE_LABELS,
  formatDate,
  formatDateTime,
  formatTime,
  fullName,
  METHOD_LABELS,
  SESSION_LABELS,
  STUDENT_STATUS_LABELS,
} from '../../lib/format';
import { AuthImage, PhotoPlaceholder } from '../../lib/hooks';
import type { AttendanceRow, Internship, StudentDetail, StudentHistory, StudentStatus } from '../../lib/types';
import { CorrectionModal } from '../attendance/CorrectionModal';

export function StudentDetailPage() {
  const { id } = useParams() as { id: string };
  const user = useUser();
  const isAdmin = user.role === 'ADMIN';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const student = useQuery({ queryKey: ['student', id], queryFn: () => api.get<StudentDetail>(`/students/${id}`) });
  const history = useQuery({ queryKey: ['student-history', id], queryFn: () => api.get<StudentHistory>(`/attendance/students/${id}`) });
  const qrHistory = useQuery({
    queryKey: ['student-qr', id],
    queryFn: () => api.get<{ id: string; status: string; issuedAt: string; revokedAt: string | null; revokeReason: string | null }[]>(`/students/${id}/qr`),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['student', id] });
    void queryClient.invalidateQueries({ queryKey: ['student-qr', id] });
    void queryClient.invalidateQueries({ queryKey: ['students'] });
  };

  const [modal, setModal] = useState<null | 'status' | 'regenerate' | 'revoke' | 'account' | 'internship' | 'delete'>(null);
  const [editingInternship, setEditingInternship] = useState<Internship | null>(null);
  const [correcting, setCorrecting] = useState<AttendanceRow | null>(null);
  const [qrVersion, setQrVersion] = useState(0);
  const [actionError, setActionError] = useState<unknown>(null);

  if (student.isPending) return <Loading />;
  if (student.error) return <ErrorAlert error={student.error} />;
  const s = student.data;
  const hasActiveQr = Boolean(s.activeQrIssuedAt);

  return (
    <div>
      <PageHeader
        title={fullName(s)}
        description={`Matricule ${s.matricule} · ${s.faculty.name} · ${s.department.name} · ${s.promotion.label}`}
        actions={
          isAdmin && (
            <>
              <Button variant="secondary" onClick={() => navigate(`/etudiants/${id}/modifier`)}>
                Modifier
              </Button>
              <Button variant="secondary" onClick={() => setModal('status')}>
                Changer le statut
              </Button>
              <Button variant="danger" onClick={() => setModal('delete')}>
                Supprimer
              </Button>
            </>
          )
        }
      />
      {actionError ? (
        <div className="mb-4">
          <ErrorAlert error={actionError} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Fiche">
          <div className="flex gap-4">
            <AuthImage
              src={s.hasPhoto ? `/students/${id}/photo?v=${qrVersion}` : null}
              alt={`Photo de ${fullName(s)}`}
              className="h-32 w-26 shrink-0 rounded object-cover ring-1 ring-slate-200"
              fallback={<PhotoPlaceholder className="h-32 w-26 shrink-0 rounded" />}
            />
            <dl className="space-y-1 text-sm">
              <div>
                <Badge tone={studentTone(s.status)}>{STUDENT_STATUS_LABELS[s.status]}</Badge>
              </div>
              <dt className="sr-only">Inscription</dt>
              <dd>Inscrit le {formatDate(s.enrolledAt)}</dd>
              <dd>{s.email ?? 'Pas d’e-mail'}</dd>
              <dd>{s.phone ?? 'Pas de téléphone'}</dd>
            </dl>
          </div>
          {isAdmin && <PhotoActions studentId={id} hasPhoto={s.hasPhoto} onDone={() => { refresh(); setQrVersion((v) => v + 1); }} onError={setActionError} />}
        </Card>

        <Card title="QR Code">
          {hasActiveQr ? (
            <>
              {isAdmin && (
                <AuthImage src={`/students/${id}/qr.png?v=${qrVersion}`} alt="QR Code de l'étudiant" className="mx-auto h-44 w-44" />
              )}
              <p className="mt-2 text-sm text-slate-600">Actif depuis le {formatDateTime(s.activeQrIssuedAt)}</p>
            </>
          ) : (
            <Alert tone="warning">Aucun QR Code actif : l'étudiant ne peut pas pointer par QR.</Alert>
          )}
          {isAdmin && (
            <div className="mt-4 flex flex-wrap gap-2">
              {hasActiveQr && (
                <>
                  <Button variant="secondary" onClick={() => downloadFile(`/students/${id}/qr.png`, `qr-${s.matricule}.png`).catch(setActionError)}>
                    Télécharger PNG
                  </Button>
                  <Button variant="secondary" onClick={() => openFile(`/students/${id}/card.pdf`).catch(setActionError)}>
                    Imprimer la carte
                  </Button>
                </>
              )}
              <Button variant="secondary" onClick={() => setModal('regenerate')}>
                {hasActiveQr ? 'Régénérer' : 'Générer un QR'}
              </Button>
              {hasActiveQr && (
                <Button variant="danger" onClick={() => setModal('revoke')}>
                  Révoquer
                </Button>
              )}
            </div>
          )}
          {qrHistory.data && qrHistory.data.length > 1 && (
            <details className="mt-4 text-xs text-slate-600">
              <summary className="cursor-pointer">Historique ({qrHistory.data.length})</summary>
              <ul className="mt-2 space-y-1">
                {qrHistory.data.map((q) => (
                  <li key={q.id}>
                    {formatDateTime(q.issuedAt)} — {q.status === 'ACTIVE' ? 'actif' : q.status === 'REVOKED' ? 'révoqué' : 'remplacé'}
                    {q.revokeReason ? ` (${q.revokeReason})` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>

        <Card title="Compte de connexion">
          {s.account ? (
            <dl className="space-y-1 text-sm">
              <dd>
                Identifiant : <span className="font-mono">{s.account.username}</span>
              </dd>
              <dd>{s.account.isActive ? <Badge tone="success">Actif</Badge> : <Badge tone="danger">Désactivé</Badge>}</dd>
              <dd className="text-slate-600">Dernière connexion : {formatDateTime(s.account.lastLoginAt)}</dd>
            </dl>
          ) : (
            <>
              <p className="text-sm text-slate-600">L'étudiant n'a pas encore de compte pour consulter son espace.</p>
              {isAdmin && (
                <Button className="mt-3" variant="secondary" onClick={() => setModal('account')}>
                  Créer le compte
                </Button>
              )}
            </>
          )}
        </Card>
      </div>

      <Card
        className="mt-6"
        title="Stages"
        actions={
          isAdmin && (
            <Button variant="secondary" onClick={() => { setEditingInternship(null); setModal('internship'); }}>
              Ajouter une période
            </Button>
          )
        }
      >
        {s.internships.length === 0 ? (
          <Empty>Aucune période de stage : l'étudiant n'est attendu à aucun pointage.</Empty>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Début</th>
                  <th className={thClass}>Fin</th>
                  <th className={thClass}>Service d'accueil</th>
                  {isAdmin && <th className={thClass}><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {s.internships.map((i) => (
                  <tr key={i.id}>
                    <td className={tdClass}>{formatDate(i.startDate)}</td>
                    <td className={tdClass}>{formatDate(i.endDate)}</td>
                    <td className={tdClass}>{i.hostService ?? '—'}</td>
                    {isAdmin && (
                      <td className={`${tdClass} text-right`}>
                        <Button variant="ghost" onClick={() => { setEditingInternship(i); setModal('internship'); }}>
                          Modifier
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <Card className="mt-6" title="Présences (30 derniers jours)">
        {history.data && (
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <StatCard label="Présences" value={history.data.stats.present} tone="green" />
            <StatCard label="Retards" value={history.data.stats.late} tone="amber" />
            <StatCard label="Absences" value={history.data.stats.absent} tone="red" />
            <StatCard label="Taux de présence" value={history.data.stats.rate === null ? '—' : `${history.data.stats.rate} %`} hint="30 derniers jours" />
          </div>
        )}
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
                  <th className={thClass}>Mode</th>
                  {isAdmin && <th className={thClass}><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {history.data.items.map((r) => (
                  <tr key={r.id}>
                    <td className={tdClass}>{formatDate(r.date)}</td>
                    <td className={tdClass}>{SESSION_LABELS[r.sessionType]}</td>
                    <td className={tdClass}>
                      <Badge tone={attendanceTone(r.status)}>{ATTENDANCE_LABELS[r.status]}</Badge>
                      {r.isCorrected && <span className="ml-2 text-xs text-slate-600">corrigé</span>}
                    </td>
                    <td className={`${tdClass} tabular-nums`}>{formatTime(r.recordedAt)}</td>
                    <td className={tdClass}>{METHOD_LABELS[r.method]}</td>
                    {isAdmin && (
                      <td className={`${tdClass} text-right`}>
                        <Button variant="ghost" onClick={() => setCorrecting({ ...r, student: { ...r.student } })}>
                          Corriger
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <StatusModal open={modal === 'status'} student={s} onClose={() => setModal(null)} onDone={refresh} />
      <ReasonModal
        open={modal === 'regenerate'}
        title={hasActiveQr ? 'Régénérer le QR Code' : 'Générer un QR Code'}
        warning={hasActiveQr ? "L'ancien QR Code cessera immédiatement de fonctionner. Pensez à réimprimer la carte." : undefined}
        confirm={hasActiveQr ? 'Régénérer' : 'Générer'}
        onClose={() => setModal(null)}
        submit={(reason) => api.post(`/students/${id}/qr/regenerate`, { reason })}
        onDone={() => { refresh(); setQrVersion((v) => v + 1); }}
      />
      <ReasonModal
        open={modal === 'revoke'}
        title="Révoquer le QR Code"
        warning="L'étudiant ne pourra plus pointer avec ce QR Code. Aucun nouveau code n'est créé."
        confirm="Révoquer"
        danger
        onClose={() => setModal(null)}
        submit={(reason) => api.post(`/students/${id}/qr/revoke`, { reason })}
        onDone={() => { refresh(); setQrVersion((v) => v + 1); }}
      />
      <ReasonModal
        open={modal === 'delete'}
        title="Supprimer l'étudiant"
        warning={`Suppression définitive de ${fullName(s)} (${s.matricule}) : fiche, périodes de stage, QR Code et compte de connexion. Réservée aux enregistrements faits par erreur : si des présences existent déjà, la suppression est refusée (utilisez alors « Changer le statut »).`}
        confirm="Supprimer définitivement"
        danger
        onClose={() => setModal(null)}
        submit={(reason) => api.del(`/students/${id}`, { reason })}
        onDone={() => {
          void queryClient.invalidateQueries({ queryKey: ['students'] });
          queryClient.removeQueries({ queryKey: ['student', id] });
          navigate('/etudiants', { replace: true });
        }}
      />
      <AccountModal open={modal === 'account'} studentId={id} matricule={s.matricule} onClose={() => setModal(null)} onDone={refresh} />
      <InternshipModal
        open={modal === 'internship'}
        studentId={id}
        internship={editingInternship}
        onClose={() => setModal(null)}
        onDone={refresh}
      />
      <CorrectionModal row={correcting} onClose={() => setCorrecting(null)} />
    </div>
  );
}

function PhotoActions({ studentId, hasPhoto, onDone, onError }: { studentId: string; hasPhoto: boolean; onDone: () => void; onError: (e: unknown) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('photo', file);
      return api.upload(`/students/${studentId}/photo`, form);
    },
    onSuccess: onDone,
    onError,
  });
  const remove = useMutation({ mutationFn: () => api.del(`/students/${studentId}/photo`), onSuccess: onDone, onError });
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const f = e.target.files?.[0];
          if (f) upload.mutate(f);
          e.target.value = '';
        }}
      />
      <Button variant="secondary" loading={upload.isPending} onClick={() => input.current?.click()}>
        {hasPhoto ? 'Changer la photo' : 'Ajouter une photo'}
      </Button>
      {hasPhoto && (
        <Button variant="ghost" loading={remove.isPending} onClick={() => remove.mutate()}>
          Retirer
        </Button>
      )}
      <p className="w-full text-xs text-slate-600">JPEG ou PNG, 2 Mo maximum.</p>
    </div>
  );
}

function ReasonModal(props: {
  open: boolean;
  title: string;
  warning?: string;
  confirm: string;
  danger?: boolean;
  onClose: () => void;
  submit: (reason: string) => Promise<unknown>;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: () => props.submit(reason),
    onSuccess: () => {
      props.onDone();
      close();
    },
  });
  function close() {
    setReason('');
    mutation.reset();
    props.onClose();
  }
  return (
    <Modal
      open={props.open}
      title={props.title}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Annuler
          </Button>
          <Button variant={props.danger ? 'danger' : 'primary'} loading={mutation.isPending} disabled={reason.trim().length < 5} onClick={() => mutation.mutate()}>
            {props.confirm}
          </Button>
        </>
      }
    >
      {props.warning && <Alert tone="warning">{props.warning}</Alert>}
      <ErrorAlert error={mutation.error} />
      <Field label="Motif" hint="Obligatoire, inscrit au journal d'audit" required>
        {(fid) => <Textarea id={fid} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />}
      </Field>
    </Modal>
  );
}

function StatusModal({ open, student, onClose, onDone }: { open: boolean; student: StudentDetail; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = useState<StudentStatus | ''>('');
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: () => api.patch(`/students/${student.id}/status`, { status, reason }),
    onSuccess: () => {
      onDone();
      close();
    },
  });
  function close() {
    setStatus('');
    setReason('');
    mutation.reset();
    onClose();
  }
  return (
    <Modal
      open={open}
      title="Changer le statut"
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Annuler
          </Button>
          <Button loading={mutation.isPending} disabled={!status || reason.trim().length < 5} onClick={() => mutation.mutate()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <p className="text-sm">
        Statut actuel : <strong>{STUDENT_STATUS_LABELS[student.status]}</strong>. Un étudiant suspendu ou dont le stage est terminé ne peut plus pointer
        et n'est plus compté absent.
      </p>
      <ErrorAlert error={mutation.error} />
      <Field label="Nouveau statut" required>
        {(fid) => (
          <Select id={fid} value={status} onChange={(e) => setStatus(e.target.value as StudentStatus)}>
            <option value="">Choisir…</option>
            {(Object.keys(STUDENT_STATUS_LABELS) as StudentStatus[])
              .filter((x) => x !== student.status)
              .map((x) => (
                <option key={x} value={x}>
                  {STUDENT_STATUS_LABELS[x]}
                </option>
              ))}
          </Select>
        )}
      </Field>
      <Field label="Motif" required>
        {(fid) => <Textarea id={fid} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />}
      </Field>
    </Modal>
  );
}

function AccountModal({ open, studentId, matricule, onClose, onDone }: { open: boolean; studentId: string; matricule: string; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const mutation = useMutation({
    mutationFn: () => api.post(`/students/${studentId}/account`, { temporaryPassword: password }),
    onSuccess: () => {
      onDone();
      close();
    },
  });
  function close() {
    setPassword('');
    mutation.reset();
    onClose();
  }
  return (
    <Modal
      open={open}
      title="Créer le compte étudiant"
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Annuler
          </Button>
          <Button loading={mutation.isPending} disabled={password.length < 10} onClick={() => mutation.mutate()}>
            Créer
          </Button>
        </>
      }
    >
      <p className="text-sm">
        Identifiant de connexion : <span className="font-mono">{matricule.toLowerCase()}</span>. L'étudiant devra changer ce mot de passe à sa première
        connexion.
      </p>
      <ErrorAlert error={mutation.error} />
      <Field label="Mot de passe provisoire" hint="10 caractères minimum, au moins une lettre et un chiffre" required>
        {(fid) => <Input id={fid} type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
    </Modal>
  );
}

function InternshipModal({ open, studentId, internship, onClose, onDone }: { open: boolean; studentId: string; internship: Internship | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ startDate: '', endDate: '', hostService: '' });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const key = internship?.id ?? 'new';
  if (open && loadedFor !== key) {
    setLoadedFor(key);
    setForm({ startDate: internship?.startDate ?? '', endDate: internship?.endDate ?? '', hostService: internship?.hostService ?? '' });
  }
  const save = useMutation({
    mutationFn: () =>
      internship
        ? api.patch(`/students/${studentId}/internships/${internship.id}`, form)
        : api.post(`/students/${studentId}/internships`, form),
    onSuccess: () => {
      onDone();
      close();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/students/${studentId}/internships/${internship!.id}`),
    onSuccess: () => {
      onDone();
      close();
    },
  });
  function close() {
    setLoadedFor(null);
    save.reset();
    remove.reset();
    onClose();
  }
  return (
    <Modal
      open={open}
      title={internship ? 'Modifier la période de stage' : 'Ajouter une période de stage'}
      onClose={close}
      footer={
        <>
          {internship && (
            <Button variant="danger" className="mr-auto" loading={remove.isPending} onClick={() => remove.mutate()}>
              Supprimer
            </Button>
          )}
          <Button variant="secondary" onClick={close}>
            Annuler
          </Button>
          <Button loading={save.isPending} disabled={!form.startDate || !form.endDate} onClick={() => save.mutate()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <ErrorAlert error={save.error ?? remove.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Début" required>
          {(fid) => <Input id={fid} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />}
        </Field>
        <Field label="Fin" required>
          {(fid) => <Input id={fid} type="date" value={form.endDate} min={form.startDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />}
        </Field>
      </div>
      <Field label="Service d'accueil">
        {(fid) => <Input id={fid} value={form.hostService} onChange={(e) => setForm({ ...form, hostService: e.target.value })} maxLength={150} />}
      </Field>
      {internship && <p className="text-xs text-slate-600">Seule une période qui n'a pas encore commencé peut être supprimée.</p>}
    </Modal>
  );
}
