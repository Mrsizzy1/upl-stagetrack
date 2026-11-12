import { useQuery } from '@tanstack/react-query';
import { Html5Qrcode } from 'html5-qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CheckSquareIcon, MonitorIcon, QrCodeIcon, WrenchIcon } from '../../components/Icons';
import { Alert, Badge, Button, Card, Input, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { MACHINE_STATUS_LABELS } from '../../lib/format';
import type { PublicMachineView } from '../../lib/types';
import { MachineControlModal } from './MachineControlModal';

const READER_ID = 'tech-qr-reader';

export function TechnicianScanPage() {
  const [token, setToken] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [controlOpen, setControlOpen] = useState(false);

  const qrInstance = useRef<Html5Qrcode | null>(null);

  // Recherche de la machine par le token scanné
  const { data: machine, isLoading, error } = useQuery({
    queryKey: ['tech-scan-machine', token],
    queryFn: () => api.get<PublicMachineView>(`/m/${token}`),
    enabled: Boolean(token),
  });

  const handleScanText = useCallback((text: string) => {
    // Le QR code contient /m/<publicToken> ou directement le token UUID
    const match = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (match) {
      setToken(match[0]);
    } else {
      setManualCode(text);
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const html5Qr = new Html5Qrcode(READER_ID);
      qrInstance.current = html5Qr;

      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScanText(decodedText);
          if (navigator.vibrate) navigator.vibrate(60);
        },
        () => undefined,
      );
      setCameraActive(true);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Impossible d’accéder à la caméra');
      setCameraActive(false);
    }
  }, [handleScanText]);

  const stopCamera = useCallback(async () => {
    if (qrInstance.current && qrInstance.current.isScanning) {
      await qrInstance.current.stop().catch(() => undefined);
      qrInstance.current.clear();
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  return (
    <div>
      <PageHeader
        title="Scanner un ordinateur"
        description="Scannez le QR Code collé sur un ordinateur en salle de TP pour voir sa fiche ou enregistrer un contrôle."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/parc/laboratoires">
              <Button variant="secondary" className="inline-flex items-center gap-1.5">
                <MonitorIcon size={16} />
                <span>Voir les salles</span>
              </Button>
            </Link>
            <Link to="/parc/interventions">
              <Button variant="secondary" className="inline-flex items-center gap-1.5">
                <WrenchIcon size={16} />
                <span>Pannes déclarées</span>
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Module Caméra */}
        <Card title="Lecture de l'étiquette QR">
          <div className="space-y-4">
            <div
              id={READER_ID}
              className="w-full aspect-square max-w-[360px] mx-auto bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center text-white"
            >
              {!cameraActive && (
                <div className="text-center p-6 text-slate-400">
                  <div className="flex justify-center mb-2">
                    <QrCodeIcon size={36} className="text-slate-500" />
                  </div>
                  <span className="text-xs">Caméra inactive</span>
                </div>
              )}
            </div>

            {cameraError && <Alert tone="danger">{cameraError}</Alert>}

            <div className="flex justify-center gap-3">
              {!cameraActive ? (
                <Button variant="primary" onClick={() => void startCamera()}>
                  Activer la caméra
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => void stopCamera()}>
                  Arrêter la caméra
                </Button>
              )}
            </div>

            {/* Saisie manuelle alternative */}
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Ou saisir un jeton / code manuellement
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: 9b1deb4d-3b7d-4bad... ou code machine"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleScanText(manualCode);
                  }}
                />
                <Button variant="secondary" onClick={() => handleScanText(manualCode)}>
                  Charger
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Résultat du scan & Déclenchement du contrôle */}
        <Card title="Poste identifié">
          {!token ? (
            <p className="text-xs text-slate-500 py-12 text-center">
              Scannez le QR Code collé sur une machine pour afficher sa fiche technique.
            </p>
          ) : isLoading ? (
            <p className="text-xs text-slate-600 py-12 text-center">Recherche de la machine en cours...</p>
          ) : error || !machine ? (
            <Alert tone="danger" title="QR Code introuvable">
              Le jeton scanné ne correspond à aucun poste configuré dans la base du parc informatique.
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-upl-blue-700 bg-upl-blue-100 px-2 py-0.5 rounded">
                    {machine.code}
                  </span>
                  <Badge tone={machine.generalStatus === 'FUNCTIONAL' ? 'success' : machine.generalStatus === 'DEFECTIVE' ? 'danger' : 'warning'}>
                    {MACHINE_STATUS_LABELS[machine.generalStatus]}
                  </Badge>
                </div>
                <h3 className="font-extrabold text-base text-upl-blue-950">{machine.name}</h3>
                <p className="text-xs text-slate-600 mt-1">
                  {machine.laboratory} — {machine.row} (Poste #{machine.position})
                </p>
              </div>

              {/* État synthétique */}
              <div className="border border-slate-200 rounded-lg p-3 text-xs space-y-2">
                <p className="font-bold text-slate-800">Composants déclarés :</p>
                <div className="grid grid-cols-2 gap-2">
                  {machine.components.map((c) => (
                    <div key={c.code} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100">
                      <span className="text-slate-700">{c.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        c.state === 'FUNCTIONAL' ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
                      }`}>
                        {c.state}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Button variant="primary" onClick={() => setControlOpen(true)} className="w-full inline-flex items-center justify-center gap-2">
                  <CheckSquareIcon size={18} />
                  <span>Démarrer le contrôle technique de ce poste</span>
                </Button>
                <Link
                  to={`/m/${token}`}
                  target="_blank"
                  className="text-center text-xs text-upl-blue-700 font-semibold hover:underline"
                >
                  Ouvrir la fiche publique externe
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Modale de contrôle technique */}
      {token && machine && (
        <MachineControlModal
          open={controlOpen}
          machineId={token}
          machineCode={machine.code}
          onClose={() => setControlOpen(false)}
          onSuccess={() => {
            setControlOpen(false);
            alert(`Contrôle certifié avec succès pour le poste ${machine.code} !`);
          }}
        />
      )}
    </div>
  );
}

