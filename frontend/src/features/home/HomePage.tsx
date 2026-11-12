import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { UPLLogo } from '../../components/UPLLogo';
import {
  GraduationCapIcon,
  SearchIcon,
  MonitorIcon,
  WrenchIcon,
  ArrowRightIcon,
  CheckCircleIcon,
} from '../../components/Icons';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { homeFor } from '../../lib/routes';
import type { InstitutionSetting } from '../../lib/types';

export function HomePage() {
  const { state } = useAuth();

  const { data: settings } = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => api.get<InstitutionSetting>('/settings'),
    staleTime: 60_000,
  });

  const institutionName = settings?.institutionName ?? 'Université Protestante de Lubumbashi';
  const facultyName = settings?.facultyName ?? 'Faculté des Sciences Informatiques';
  const acronym = settings?.acronym ?? 'UPL';

  return (
    <div className="min-h-screen bg-slate-50 text-upl-blue-950 flex flex-col selection:bg-upl-gold-500 selection:text-upl-blue-950">
      {/* -------------------------------------------------------------------- */}
      {/* EN-TÊTE OFFICIEL */}
      {/* -------------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-upl-blue-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3.5 focus-visible:outline-2 focus-visible:outline-upl-blue-700 rounded-lg p-1">
            <UPLLogo size="md" priority />
            <div className="leading-tight">
              <span className="block font-bold text-base sm:text-lg tracking-tight text-upl-blue-900">
                {acronym} StageTrack
              </span>
              <span className="block text-xs sm:text-sm font-medium text-slate-500 truncate max-w-[200px] sm:max-w-md">
                {facultyName}
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-600">
            <a href="#services" className="hover:text-upl-blue-700 transition-colors">
              Nos services
            </a>
            <a href="#presentation" className="hover:text-upl-blue-700 transition-colors">
              Présentation
            </a>
            <a href="#contact" className="hover:text-upl-blue-700 transition-colors">
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {state.status === 'authenticated' ? (
              <Link
                to={homeFor(state.user.role)}
                className="inline-flex items-center justify-center rounded-lg bg-upl-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-upl-blue-800 transition-colors"
              >
                Accéder à mon espace ({state.user.username})
              </Link>
            ) : (
              <Link
                to="/connexion"
                className="inline-flex items-center justify-center rounded-lg bg-upl-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-upl-blue-800 transition-colors focus-visible:outline-2 focus-visible:outline-upl-blue-700"
              >
                Connexion
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------------- */}
      {/* HERO SECTION */}
      {/* -------------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-upl-blue-900 via-upl-blue-950 to-upl-blue-950 text-white py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#f9b233_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-upl-gold-500 ring-1 ring-inset ring-white/15 mb-6">
            <span>Portail Numérique Officiel — {institutionName}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight sm:leading-none text-white">
            Bienvenue sur le portail numérique de la faculté
          </h1>

          <p className="mt-6 text-base sm:text-xl text-upl-blue-100 max-w-2xl mx-auto leading-relaxed">
            Une plateforme centralisée facilitant l'accès aux services universitaires, le suivi des stages, la gestion des
            objets perdus et la supervision des équipements informatiques.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a
              href="#services"
              className="rounded-lg bg-upl-gold-500 px-6 py-3.5 text-sm font-bold text-upl-blue-950 shadow-sm hover:bg-upl-gold-500/90 transition-transform active:scale-95"
            >
              Découvrir les services disponibles
            </a>
            <Link
              to="/objets"
              className="rounded-lg bg-white/10 px-6 py-3.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/20 hover:bg-white/20 transition-colors"
            >
              Objets trouvés & perdus
            </Link>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION SERVICES */}
      {/* -------------------------------------------------------------------- */}
      <section id="services" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-wider text-upl-blue-700">Nos 4 piliers numériques</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-upl-blue-900 sm:text-4xl">
            Choisissez le service auquel vous souhaitez accéder
          </p>
          <p className="mt-3 text-slate-600">
            Des espaces dédiés à chaque acteur universitaire, avec des accès publics directs ou des espaces sécurisés selon vos responsabilités.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* SERVICE 1 : GESTION DES STAGES */}
          <div className="rounded-2xl bg-white p-8 ring-1 ring-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="h-12 w-12 rounded-xl bg-upl-blue-100 text-upl-blue-700 flex items-center justify-center mb-6">
                <GraduationCapIcon size={24} />
              </div>
              <h3 className="text-xl font-bold text-upl-blue-950">Gestion des stages</h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Espace dédié aux étudiants stagiaires, aux encadreurs et aux responsables pour assurer le suivi des activités
                et des présences en temps réel.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-upl-blue-700 shrink-0" />
                  <span>Suivi des présences et émargement</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-upl-blue-700 shrink-0" />
                  <span>Consultation des absences et des retards</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-upl-blue-700 shrink-0" />
                  <span>Historique des stages et affectations</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-upl-blue-700 shrink-0" />
                  <span>Cartes étudiantes et rapports d'émargement</span>
                </li>
              </ul>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100">
              <Link
                to={state.status === 'authenticated' ? '/tableau-de-bord' : '/connexion'}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-upl-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-upl-blue-800 transition-colors"
              >
                <span>Accéder à la gestion des stages</span>
                <ArrowRightIcon size={16} />
              </Link>
            </div>
          </div>

          {/* SERVICE 2 : OBJETS PERDUS ET RETROUVÉS */}
          <div className="rounded-2xl bg-white p-8 ring-1 ring-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow border-t-4 border-t-upl-gold-500">
            <div>
              <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-6">
                <SearchIcon size={24} />
              </div>
              <h3 className="text-xl font-bold text-upl-blue-950">Objets perdus et retrouvés</h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Un portail public permettant à tout membre de la faculté ou visiteur de déclarer un objet perdu, signaler un
                objet retrouvé ou rechercher un objet égaré.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-amber-800 shrink-0" />
                  <span>Consultation publique sans compte obligatoire</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-amber-800 shrink-0" />
                  <span>Déclarer un objet perdu ou signaler un objet trouvé</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-amber-800 shrink-0" />
                  <span>Recherche par catégorie, date et lieu de perte</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-amber-800 shrink-0" />
                  <span>Soumission de demande de restitution avec preuve</span>
                </li>
              </ul>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100">
              <Link
                to="/objets"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 transition-colors"
              >
                <span>Accéder au portail des objets perdus</span>
                <ArrowRightIcon size={16} />
              </Link>
            </div>
          </div>

          {/* SERVICE 3 : PARC INFORMATIQUE */}
          <div className="rounded-2xl bg-white p-8 ring-1 ring-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="h-12 w-12 rounded-xl bg-slate-100 text-upl-blue-900 flex items-center justify-center mb-6">
                <MonitorIcon size={24} />
              </div>
              <h3 className="text-xl font-bold text-upl-blue-950">Parc informatique</h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Espace de consultation des laboratoires et des équipements informatiques. Chaque machine est identifiable
                immédiatement par son QR code permanent.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-upl-blue-700 shrink-0" />
                  <span>Consultation des salles et des postes informatiques</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-upl-blue-700 shrink-0" />
                  <span>Identification physique par QR Code permanent</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-upl-blue-700 shrink-0" />
                  <span>Fiche publique mobile après scan en salle de TP</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-upl-blue-700 shrink-0" />
                  <span>État fonctionnel des équipements et composants</span>
                </li>
              </ul>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100">
              <Link
                to={state.status === 'authenticated' ? '/parc/laboratoires' : '/connexion'}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 transition-colors"
              >
                <span>Explorer le parc informatique</span>
                <ArrowRightIcon size={16} />
              </Link>
            </div>
          </div>

          {/* SERVICE 4 : ESPACE TECHNICIEN */}
          <div className="rounded-2xl bg-white p-8 ring-1 ring-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow border-t-4 border-t-upl-blue-700">
            <div>
              <div className="h-12 w-12 rounded-xl bg-upl-blue-50 text-upl-blue-700 flex items-center justify-center mb-6">
                <WrenchIcon size={24} />
              </div>
              <h3 className="text-xl font-bold text-upl-blue-950">Espace technicien</h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Espace professionnel sécurisé réservé aux techniciens informatiques pour assurer le contrôle périodique, la
                maintenance préventive et le suivi des pannes.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-upl-blue-700 shrink-0" />
                  <span>Scanner QR Code mobile et contrôle composant par composant</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-upl-blue-700 shrink-0" />
                  <span>Plan visuel 2D interactif des laboratoires</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-upl-blue-700 shrink-0" />
                  <span>Historique immuable des contrôles techniques</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={16} className="text-upl-blue-700 shrink-0" />
                  <span>Signalement des pannes et gestion des interventions</span>
                </li>
              </ul>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100">
              <Link
                to={state.status === 'authenticated' ? '/parc/technicien' : '/connexion'}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-upl-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-upl-blue-800 transition-colors"
              >
                <span>Accéder à l'espace technicien</span>
                <ArrowRightIcon size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION PRÉSENTATION INSTITUTIONNELLE */}
      {/* -------------------------------------------------------------------- */}
      <section id="presentation" className="bg-white border-y border-slate-200/80 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-10">
          <div className="shrink-0">
            <UPLLogo size="lg" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-upl-blue-950 sm:text-3xl">
              {institutionName} — {facultyName}
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed text-sm sm:text-base">
              La Faculté des Sciences Informatiques s'engage à former l'élite technologique de demain tout en assurant une
              gestion rigoureuse et moderne de ses infrastructures. UPL StageTrack répond à cet impératif en offrant une
              traçabilité irréprochable des présences en stage, une gestion transparente des objets égarés sur le campus et
              un maintien en condition opérationnelle permanent des laboratoires informatiques.
            </p>
            <div className="mt-6 flex flex-wrap gap-6 text-sm font-semibold text-slate-700">
              <div>
                <span className="block text-2xl font-extrabold text-upl-blue-700">100%</span>
                <span className="text-xs uppercase tracking-wider text-slate-500">Traçabilité numérique</span>
              </div>
              <div className="border-l border-slate-200 pl-6">
                <span className="block text-2xl font-extrabold text-upl-gold-800">Permanent</span>
                <span className="text-xs uppercase tracking-wider text-slate-500">QR Codes invariants</span>
              </div>
              <div className="border-l border-slate-200 pl-6">
                <span className="block text-2xl font-extrabold text-upl-blue-900">Immuable</span>
                <span className="text-xs uppercase tracking-wider text-slate-500">Audit et contrôles</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION CONTACT */}
      {/* -------------------------------------------------------------------- */}
      <section id="contact" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="rounded-2xl bg-upl-blue-50 p-8 sm:p-12 ring-1 ring-upl-blue-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-upl-blue-950">Besoin d'assistance ou d'un renseignement ?</h2>
            <p className="mt-2 text-sm text-slate-600 max-w-xl">
              Le secrétariat académique et le service technique des laboratoires se tiennent à votre disposition.
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-700">
              {settings?.contactEmail && (
                <span className="font-medium">
                  Courriel : <a href={`mailto:${settings.contactEmail}`} className="text-upl-blue-700 hover:underline">{settings.contactEmail}</a>
                </span>
              )}
              {settings?.contactPhone && (
                <span className="font-medium">
                  Téléphone : <span className="text-upl-blue-900">{settings.contactPhone}</span>
                </span>
              )}
              {settings?.address && (
                <span className="font-medium">
                  Campus : <span className="text-slate-600">{settings.address}</span>
                </span>
              )}
            </div>
          </div>
          <Link
            to="/connexion"
            className="shrink-0 rounded-lg bg-upl-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-upl-blue-800 transition-colors"
          >
            Se connecter au portail
          </Link>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* FOOTER */}
      {/* -------------------------------------------------------------------- */}
      <footer className="mt-auto bg-upl-blue-950 text-upl-blue-100 border-t border-white/10 py-10 px-4 sm:px-6 lg:px-8 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <UPLLogo size="sm" decorative />
            <span>
              {institutionName} — {facultyName} © {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex gap-6">
            <Link to="/objets" className="hover:text-white transition-colors">
              Objets trouvés & perdus
            </Link>
            <Link to="/connexion" className="hover:text-white transition-colors">
              Connexion
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

