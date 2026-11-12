import { useRouteError, isRouteErrorResponse, Link } from 'react-router';
import { UPLLogo, UNIVERSITY_NAME } from './UPLLogo';
import { AlertCircleIcon, HomeIcon } from './Icons';
import { buttonClass } from './ui';

export function RootErrorBoundary() {
  const error = useRouteError();

  let title = 'Une erreur inattendue est survenue';
  let message = 'Veuillez recharger la page ou revenir à l’accueil.';

  if (isRouteErrorResponse(error)) {
    title = `Erreur ${error.status}`;
    message = error.statusText || message;
  } else if (error instanceof Error && import.meta.env.DEV) {
    // Détail technique réservé au développement : en production, le message générique suffit.
    message = error.message;
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg ring-1 ring-slate-200">
        <div className="flex justify-center">
          <UPLLogo heightClass="h-12" />
        </div>
        <span className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-200">
          <AlertCircleIcon size={24} />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{message}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={() => window.location.reload()} className={buttonClass('primary')}>
            Recharger la page
          </button>
          <Link to="/" className={buttonClass('secondary')}>
            <HomeIcon size={16} />
            Accueil
          </Link>
        </div>
        <p className="mt-6 text-xs text-slate-400">{UNIVERSITY_NAME}</p>
      </div>
    </div>
  );
}
