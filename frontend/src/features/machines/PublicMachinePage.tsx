import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router';
import { UPLLogo } from '../../components/UPLLogo';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  MonitorIcon,
  WrenchIcon,
  ArrowRightIcon,
} from '../../components/Icons';
import { Alert, Button, Loading } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { COMPONENT_STATE_LABELS, formatDateTime, MACHINE_STATUS_LABELS } from '../../lib/format';
import type { PublicMachineView } from '../../lib/types';

const ISSUE_TYPES = [
  { value: 'Écran / Affichage', label: 'Écran ou affichage (noir, éteint, scintillement)' },
  { value: 'Clavier / Souris', label: 'Clavier ou souris défectueux / manquant' },
  { value: 'Démarrage', label: "L'ordinateur ne s'allume pas ou s'éteint tout seul" },
  { value: 'Réseau / Internet', label: 'Pas de connexion réseau ou câble débranché' },
  { value: 'Système / Logiciel', label: 'Système d’exploitation bloqué ou lent' },
  { value: 'Autre incident', label: 'Autre problème matériel ou équipement endommagé' },
];

export function PublicMachinePage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();

  // État du formulaire de signalement
  const [reportOpen, setReportOpen] = useState(false);
  const [issueType, setIssueType] = useState(ISSUE_TYPES[0].value);
  const [issueDescription, setIssueDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // Accordéon des détails techniques (masqué par défaut pour ne pas surcharger)
  const [showTechDetails, setShowTechDetails] = useState(false);

  const { data: machine, isLoading, error } = useQuery({
    queryKey: ['public-machine', token],
    queryFn: () => api.get<PublicMachineView>(`/m/${token}`),
    enabled: Boolean(token),
    retry: 1,
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      api.post(`/m/${token}/report`, {
        title: issueType,
        description: issueDescription.trim() || issueType,
        contact: reporterName.trim() || undefined,
      }),
    onSuccess: () => {
      setReportSuccess('Votre signalement a été transmis avec succès à l’équipe technique.');
      setReportOpen(false);
      setIssueDescription('');
      setReporterName('');
      void queryClient.invalidateQueries({ queryKey: ['public-machine', token] });
    },
    onError: (err) => {
      setReportError(err instanceof ApiError ? err.message : 'Erreur lors de l’envoi du signalement');
    },
  });

  const handleReportSubmit = (e: FormEvent) => {
    e.preventDefault();
    setReportError(null);
    reportMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* En-tête mobile officiel épuré */}
      <header className="bg-upl-blue-900 text-white border-b border-upl-gold-500/40 px-4 py-3 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <UPLLogo size="sm" priority />
            <div className="leading-tight">
              <span className="block font-bold text-sm tracking-tight">Portail UPL</span>
              <span className="block text-[11px] text-upl-blue-200">Parc Informatique Universitaire</span>
            </div>
          </Link>
          <Link
            to="/"
            className="text-xs text-upl-gold-500 font-semibold hover:text-upl-gold-400 transition-colors"
          >
            Accueil
          </Link>
        </div>
      </header>

      {/* Contenu principal mobile épuré */}
      <main className="max-w-md w-full mx-auto p-4 flex-1 flex flex-col justify-start">
        {isLoading ? (
          <div className="bg-white rounded-2xl p-8 shadow-xs border border-slate-200 mt-6 text-center">
            <Loading label="Lecture de l'étiquette en cours…" />
          </div>
        ) : error || !machine ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mt-6 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircleIcon size={28} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">Équipement non répertorié</h1>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Ce QR Code ne correspond à aucune machine active dans l’inventaire officiel de la faculté.
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-lg bg-upl-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-upl-blue-800"
            >
              Retour à l’accueil
            </Link>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Message de succès après signalement */}
            {reportSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircleIcon size={20} className="text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900">
                  <p className="font-bold">Signalement enregistré</p>
                  <p className="mt-0.5">{reportSuccess}</p>
                </div>
              </div>
            )}

            {/* Carte principale d'identification du poste */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 text-center">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-3 py-1 rounded-full mb-3">
                Poste Informatique — Inventaire UPL
              </span>

              <h1 className="text-2xl font-black text-upl-blue-950 tracking-tight">
                {machine.name}
              </h1>
              <p className="font-mono text-xs font-bold text-slate-500 mt-1">
                {machine.code}
              </p>

              <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">
                  {machine.laboratory}
                </p>
                <p className="text-slate-500">
                  {machine.row} • Poste #{machine.position} • {machine.building}
                </p>
              </div>

              {/* État de fonctionnement en un coup d'œil */}
              <div className="mt-5">
                {machine.generalStatus === 'FUNCTIONAL' ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                    <CheckCircleIcon size={16} className="text-emerald-700" />
                    <span>Poste en service et fonctionnel</span>
                  </div>
                ) : machine.generalStatus === 'DEFECTIVE' ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold">
                    <AlertCircleIcon size={16} className="text-red-700" />
                    <span>Poste signalé en panne (Maintenance)</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                    <AlertCircleIcon size={16} className="text-amber-700" />
                    <span>{MACHINE_STATUS_LABELS[machine.generalStatus]}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action principale : Signaler un problème */}
            {!reportOpen ? (
              <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
                    <WrenchIcon size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Un problème sur ce poste ?</h2>
                    <p className="text-xs text-slate-500">Signalez-le directement au service technique.</p>
                  </div>
                </div>

                <Button
                  variant="primary"
                  className="w-full justify-center"
                  onClick={() => {
                    setReportOpen(true);
                    setReportSuccess(null);
                  }}
                >
                  <span>Signaler une panne</span>
                  <ArrowRightIcon size={16} />
                </Button>
              </div>
            ) : (
              /* Formulaire simple de signalement */
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900">Signaler un dysfonctionnement</h2>
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800"
                  >
                    Fermer
                  </button>
                </div>

                {reportError && <Alert tone="danger">{reportError}</Alert>}

                <form onSubmit={handleReportSubmit} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Quel est le composant concerné ?
                    </label>
                    <select
                      value={issueType}
                      onChange={(e) => setIssueType(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-upl-blue-600"
                    >
                      {ISSUE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Précisions (facultatif)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex : La souris ne clique plus, écran noir après allumage..."
                      value={issueDescription}
                      onChange={(e) => setIssueDescription(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-upl-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Votre prénom / contact (facultatif)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex : Patrick (Étudiant L2 Info)"
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-upl-blue-600"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-1/3 justify-center"
                      onClick={() => setReportOpen(false)}
                      disabled={reportMutation.isPending}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-2/3 justify-center"
                      loading={reportMutation.isPending}
                    >
                      Envoyer le signalement
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Accordéon repliable : Détails techniques (pour techniciens) */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTechDetails((v) => !v)}
                className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
              >
                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <MonitorIcon size={16} className="text-slate-500" />
                  <span>Détails techniques du matériel</span>
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  {showTechDetails ? 'Masquer ▲' : 'Afficher ▼'}
                </span>
              </button>

              {showTechDetails && (
                <div className="p-5 pt-2 border-t border-slate-100 text-xs space-y-3 bg-slate-50/50">
                  {(machine.brand || machine.specifications) && (
                    <div className="space-y-1">
                      <p className="text-slate-500 text-[11px] font-semibold uppercase">Modèle & Processeur</p>
                      <p className="font-semibold text-slate-800">
                        {machine.brand} {machine.model ?? ''}
                      </p>
                      {machine.specifications && (
                        <p className="text-slate-600 text-[11px] bg-white p-2 rounded border border-slate-200">
                          {machine.specifications}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5 pt-2">
                    <p className="text-slate-500 text-[11px] font-semibold uppercase">Dernier contrôle composant</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {machine.components.map((c) => (
                        <div
                          key={c.code}
                          className="bg-white p-1.5 px-2 rounded border border-slate-200 flex items-center justify-between text-[11px]"
                        >
                          <span className="text-slate-700 truncate">{c.name}</span>
                          <span
                            className={`text-[9px] font-bold px-1 rounded ${
                              c.state === 'FUNCTIONAL'
                                ? 'text-emerald-700 bg-emerald-50'
                                : 'text-red-700 bg-red-50'
                            }`}
                          >
                            {COMPONENT_STATE_LABELS[c.state]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {machine.lastControlAt && (
                    <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-200">
                      Dernier contrôle certifié le {formatDateTime(machine.lastControlAt)}
                    </p>
                  )}

                  <div className="pt-2 text-center">
                    <Link
                      to="/parc/technicien"
                      className="text-xs font-semibold text-upl-blue-700 hover:underline inline-flex items-center gap-1"
                    >
                      <span>Accéder au mode technicien certifié</span>
                      <ArrowRightIcon size={14} />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <p className="text-[10px] text-center text-slate-600 pt-2 pb-4">
              Université Protestante de Lubumbashi • Faculté des Sciences Informatiques
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
