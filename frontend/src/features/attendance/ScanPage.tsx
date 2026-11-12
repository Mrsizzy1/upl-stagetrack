/**
 * Écran de pointage (agent ou administrateur).
 * La caméra lit le QR ; le texte est envoyé tel quel à l'API, qui décide de tout
 * (heure, session, validité). L'heure affichée est celle du serveur, recalée à chaque relevé.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Html5Qrcode } from 'html5-qrcode';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, ErrorAlert, Field, Input, PageHeader } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { formatLongDate, formatTime, SESSION_LABELS } from '../../lib/format';
import { AuthImage, PhotoPlaceholder } from '../../lib/hooks';
import type { LiveStatus, ScanResponse } from '../../lib/types';

const READER_ID = 'qr-reader';
/** Un même QR relu dans ce délai est ignoré côté écran (la base empêche de toute façon le doublon). */
const SAME_CODE_DELAY_MS = 4000;

function useServerClock(live: LiveStatus | undefined, receivedAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!live) return null;
  // Heure serveur au relevé + temps écoulé depuis : affichage seulement, jamais envoyé au serveur.
  return new Date(new Date(live.serverTime).getTime() + (now - receivedAt)).toISOString();
}

export function ScanPage() {
  const queryClient = useQueryClient();
  const [receivedAt, setReceivedAt] = useState(Date.now());
  const live = useQuery({
    queryKey: ['live'],
    queryFn: async () => {
      const data = await api.get<LiveStatus>('/attendance/live');
      setReceivedAt(Date.now());
      return data;
    },
    refetchInterval: 15_000,
  });
  const serverNow = useServerClock(live.data, receivedAt);

  const [result, setResult] = useState<ScanResponse | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const lastCode = useRef<{ text: string; at: number } | null>(null);
  const busy = useRef(false);

  const onResult = useCallback(
    (res: ScanResponse) => {
      setResult(res);
      setNetworkError(null);
      if (navigator.vibrate) navigator.vibrate(res.accepted ? 80 : [60, 60, 60]);
      void queryClient.invalidateQueries({ queryKey: ['live'] });
    },
    [queryClient],
  );

  const submitQr = useCallback(
    async (text: string) => {
      const now = Date.now();
      if (busy.current) return;
      if (lastCode.current && lastCode.current.text === text && now - lastCode.current.at < SAME_CODE_DELAY_MS) return;
      lastCode.current = { text, at: now };
      busy.current = true;
      try {
        onResult(await api.post<ScanResponse>('/attendance/scan', { qr: text }));
      } catch (e) {
        setResult(null);
        setNetworkError(e instanceof ApiError ? e.message : 'Erreur de connexion.');
      } finally {
        busy.current = false;
      }
    },
    [onResult],
  );

  // Caméra
  const scanner = useRef<Html5Qrcode | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(async () => {
    const s = scanner.current;
    scanner.current = null;
    if (s) {
      try {
        if (s.isScanning) await s.stop();
        s.clear();
      } catch {
        /* caméra déjà arrêtée */
      }
    }
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (!window.isSecureContext) {
      setCameraError("La caméra exige une connexion sécurisée (HTTPS). Utilisez la saisie manuelle ou l'adresse HTTPS du serveur.");
      return;
    }
    try {
      const s = new Html5Qrcode(READER_ID, { verbose: false });
      scanner.current = s;
      await s.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: (w: number, h: number) => ({ width: Math.min(w, h) * 0.7, height: Math.min(w, h) * 0.7 }) },
        (text) => void submitQr(text),
        () => undefined,
      );
      setCameraOn(true);
    } catch (e) {
      scanner.current = null;
      setCameraError(
        `Impossible d'ouvrir la caméra : ${e instanceof Error ? e.message : String(e)}. Vérifiez l'autorisation du navigateur.`,
      );
    }
  }, [submitQr]);

  useEffect(() => () => void stopCamera(), [stopCamera]);

  // Saisie manuelle
  const [matricule, setMatricule] = useState('');
  const [reason, setReason] = useState('');
  const manual = useMutation({
    mutationFn: () => api.post<ScanResponse>('/attendance/manual', { matricule, reason }),
    onSuccess: (res) => {
      onResult(res);
      if (res.accepted) {
        setMatricule('');
        setReason('');
      }
    },
  });

  function submitManual(e: FormEvent) {
    e.preventDefault();
    manual.mutate();
  }

  const l = live.data;

  return (
    <div>
      <PageHeader title="Pointage" description="Présentez le QR Code de l'étudiant devant la caméra. Le serveur décide de l'acceptation." />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-upl-blue-900 p-4 text-white">
          <p className="text-xs uppercase tracking-wide text-upl-blue-100">Heure officielle du serveur</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{serverNow ? formatTime(serverNow) : '—'}</p>
          <p className="text-sm text-upl-blue-100">{l ? formatLongDate(l.localDate) : ''}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs uppercase tracking-wide text-slate-600">Session</p>
          <p className="mt-1 text-lg font-semibold text-upl-blue-900">
            {l?.openSession ? <Badge tone="success">{SESSION_LABELS[l.openSession]} : ouverte</Badge> : <Badge tone="neutral">Aucune session ouverte</Badge>}
          </p>
          <p className="mt-1 text-sm text-slate-600">{l?.status}</p>
          {l && l.schedule.length > 0 && (
            <ul className="mt-2 space-y-0.5 border-t border-slate-200 pt-2 text-xs text-slate-600">
              {l.schedule.map((s) => (
                <li key={s.sessionType}>
                  <span className="font-semibold">{SESSION_LABELS[s.sessionType]}</span> : {s.opensAt}–{s.closesAt}, {s.days}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs uppercase tracking-wide text-slate-600">Pointages enregistrés aujourd'hui</p>
          <div className="mt-1 flex gap-6">
            {(l?.sessions ?? []).map((s) => (
              <div key={s.sessionType}>
                <p className="text-2xl font-semibold tabular-nums text-upl-blue-900">{s.recorded}</p>
                <p className="text-xs text-slate-600">
                  {SESSION_LABELS[s.sessionType]} ({s.opensAt}–{s.closesAt})
                </p>
              </div>
            ))}
            {l && l.sessions.length === 0 && <p className="text-sm text-slate-600">Pas de session aujourd'hui</p>}
          </div>
        </div>
      </div>
      {live.isError && <div className="mb-4"><ErrorAlert error={live.error} /></div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Caméra"
          actions={
            cameraOn ? (
              <Button variant="secondary" onClick={() => void stopCamera()}>
                Arrêter la caméra
              </Button>
            ) : (
              <Button onClick={() => void startCamera()}>Démarrer la caméra</Button>
            )
          }
        >
          <div id={READER_ID} className="mx-auto aspect-square w-full max-w-md overflow-hidden rounded-md bg-upl-blue-950/5" />
          {!cameraOn && !cameraError && <p className="mt-3 text-sm text-slate-600">Démarrez la caméra pour scanner.</p>}
          {cameraError && (
            <div className="mt-3">
              <Alert tone="warning">{cameraError}</Alert>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <ResultPanel result={result} networkError={networkError} />

          <Card title="Saisie manuelle du matricule">
            <form onSubmit={submitManual} className="space-y-3">
              <ErrorAlert error={manual.error} />
              <Field label="Matricule" required>
                {(id) => <Input id={id} value={matricule} onChange={(e) => setMatricule(e.target.value)} required autoComplete="off" />}
              </Field>
              <Field label="Motif" hint="Obligatoire et journalisé : QR oublié, illisible, téléphone déchargé…" required>
                {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={5} />}
              </Field>
              <Button type="submit" loading={manual.isPending}>
                Enregistrer
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ResultPanel({ result, networkError }: { result: ScanResponse | null; networkError: string | null }) {
  if (networkError) {
    return (
      <div role="alert" className="rounded-lg border-2 border-danger-700 bg-danger-100 p-5">
        <p className="text-lg font-semibold text-danger-700">Erreur de connexion</p>
        <p className="text-sm text-danger-700">{networkError} Aucun pointage n'a été enregistré.</p>
      </div>
    );
  }
  if (!result) {
    return (
      <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white p-5 text-sm text-slate-600">
        Le résultat du dernier scan s'affichera ici.
      </div>
    );
  }
  const s = result.student;
  const ok = result.accepted;
  return (
    <div
      role="status"
      aria-live="assertive"
      className={`rounded-lg border-2 p-5 ${ok ? 'border-success-600 bg-success-100' : 'border-danger-700 bg-danger-100'}`}
    >
      <p className={`text-lg font-semibold ${ok ? 'text-success-700' : 'text-danger-700'}`}>{ok ? 'Accepté' : 'Refusé'} — {result.message}</p>
      <div className="mt-4 flex gap-4">
        {s ? (
          <AuthImage
            src={s.hasPhoto ? `/students/${s.id}/photo` : null}
            alt={`Photo de ${s.fullName}`}
            className="h-28 w-24 shrink-0 rounded object-cover ring-1 ring-slate-200"
            fallback={<PhotoPlaceholder className="h-28 w-24 shrink-0 rounded" />}
          />
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {s && (
            <>
              <dt className="text-slate-600">Nom</dt>
              <dd className="font-semibold text-slate-900">{s.fullName}</dd>
              <dt className="text-slate-600">Matricule</dt>
              <dd>{s.matricule}</dd>
              <dt className="text-slate-600">Faculté</dt>
              <dd>{s.faculty}</dd>
              <dt className="text-slate-600">Promotion</dt>
              <dd>
                {s.department} · {s.promotion}
              </dd>
            </>
          )}
          <dt className="text-slate-600">Heure</dt>
          <dd className="tabular-nums">{formatTime(result.recordedAt ?? result.serverTime)}</dd>
          <dt className="text-slate-600">Session</dt>
          <dd>{result.sessionType ? SESSION_LABELS[result.sessionType] : '—'}</dd>
        </dl>
      </div>
    </div>
  );
}
