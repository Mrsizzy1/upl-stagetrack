import { Link } from 'react-router';
import { useUser } from '../../lib/auth';
import {
  GraduationCapIcon,
  SearchIcon,
  MonitorIcon,
  SettingsIcon,
  UserIcon,
  ArrowRightIcon,
} from '../../components/Icons';

export function PortalHubPage() {
  const user = useUser();
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN'].includes(user.role);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* En-tête institutionnel */}
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-upl-blue-950 tracking-tight">
          Portail Numérique Facultaire
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600">
          Sélectionnez un service pour accéder aux outils de gestion académique, logistique et technique.
        </p>
      </div>

      {/* Cartes de services professionnels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARTE 1 : STAGES */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-upl-blue-300 hover:shadow-sm transition-all flex flex-col justify-between p-6">
          <div>
            <div className="h-11 w-11 rounded-lg bg-blue-50 text-upl-blue-700 flex items-center justify-center mb-4">
              <GraduationCapIcon size={24} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Stages & Présences</h2>
            <p className="mt-2 text-sm text-slate-600">
              Pointage par QR Code, feuilles d'émargement et suivi des stagiaires.
            </p>
          </div>
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
            <Link
              to="/tableau-de-bord"
              className="inline-flex items-center gap-2 rounded-lg bg-upl-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-upl-blue-800 transition-colors shadow-xs"
            >
              <span>Ouvrir</span>
              <ArrowRightIcon size={16} />
            </Link>
            <Link to="/presences" className="text-xs font-medium text-slate-600 hover:text-upl-blue-700">
              Émargement
            </Link>
          </div>
        </div>

        {/* CARTE 2 : OBJETS PERDUS */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-amber-300 hover:shadow-sm transition-all flex flex-col justify-between p-6">
          <div>
            <div className="h-11 w-11 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
              <SearchIcon size={22} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Objets Perdus & Trouvés</h2>
            <p className="mt-2 text-sm text-slate-600">
              Déclaration des objets égarés, catalogue public et restitutions.
            </p>
          </div>
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
            <Link
              to="/objets"
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors shadow-xs"
            >
              <span>Consulter</span>
              <ArrowRightIcon size={16} />
            </Link>
            {isAdmin && (
              <Link to="/admin/objets" className="text-xs font-medium text-slate-600 hover:text-amber-800">
                Modération
              </Link>
            )}
          </div>
        </div>

        {/* CARTE 3 : SALLES INFORMATIQUES */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-400 hover:shadow-sm transition-all flex flex-col justify-between p-6">
          <div>
            <div className="h-11 w-11 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center mb-4">
              <MonitorIcon size={22} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Salles & Parc Informatique</h2>
            <p className="mt-2 text-sm text-slate-600">
              Plan des salles de TP, état des machines et suivi des pannes.
            </p>
          </div>
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
            <Link
              to="/parc/laboratoires"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 transition-colors shadow-xs"
            >
              <span>Consulter</span>
              <ArrowRightIcon size={16} />
            </Link>
            <Link to="/parc/interventions" className="text-xs font-medium text-slate-600 hover:text-slate-900">
              Maintenance
            </Link>
          </div>
        </div>

        {/* CARTE 4 : MON ESPACE OU ADMINISTRATION */}
        {isAdmin ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-400 hover:shadow-sm transition-all flex flex-col justify-between p-6">
            <div>
              <div className="h-11 w-11 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center mb-4">
                <SettingsIcon size={22} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Administration Système</h2>
              <p className="mt-2 text-sm text-slate-600">
                Gestion des comptes, journal d'audit et configuration du portail.
              </p>
            </div>
            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
              <Link
                to="/comptes"
                className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 transition-colors shadow-xs"
              >
                <span>Gérer</span>
                <ArrowRightIcon size={16} />
              </Link>
              <Link to="/supervision" className="text-xs font-medium text-slate-600 hover:text-purple-800">
                Paramètres
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col justify-between p-6">
            <div>
              <div className="h-11 w-11 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                <UserIcon size={22} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Mon Espace Personnel</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Consultation de la fiche étudiante, téléchargement du QR Code individuel et suivi de l'assiduité.
              </p>
            </div>
            <div className="mt-6 pt-5 border-t border-slate-100">
              <Link
                to="/mon-espace"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors shadow-xs"
              >
                <span>Accéder à mon dossier</span>
                <ArrowRightIcon size={16} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
