import { useRouteError, isRouteErrorResponse, Link } from 'react-router';
import { UPLLogo, UNIVERSITY_NAME } from './UPLLogo';
import { AlertCircleIcon, HomeIcon } from './Icons';

export function RootErrorBoundary() {
  const error = useRouteError();

  let title = 'Une erreur inattendue est survenue';
  let message = 'Veuillez recharger la page ou revenir à l’accueil.';

  if (isRouteErrorResponse(error)) {
    title = `Erreur ${error.status}`;
    message = error.statusText || message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center space-y-6">
        <div className="flex justify-center">
          <UPLLogo size="md" />
        </div>
        <div className="flex justify-center text-amber-600">
          <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
            <AlertCircleIcon size={28} />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-600">{message}</p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-upl-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-upl-blue-800 transition-colors"
          >
            Recharger la page
          </button>
          <Link
            to="/hub"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <HomeIcon size={16} />
            <span>Accueil</span>
          </Link>
        </div>
        <p className="text-xs text-slate-400">{UNIVERSITY_NAME}</p>
      </div>
    </div>
  );
}

