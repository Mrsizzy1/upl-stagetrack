import { Link } from 'react-router';
import { HomeIcon } from '../../components/Icons';
import { buttonClass } from '../../components/ui';

export function NotFoundPage() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <p className="text-6xl font-semibold tracking-tight text-upl-blue-200">404</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Page introuvable</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        L'adresse demandée n'existe pas ou n'est plus disponible. Vérifiez le lien ou revenez à l'accueil.
      </p>
      <Link to="/" className={buttonClass('primary', 'md', 'mt-6')}>
        <HomeIcon size={16} />
        Retour à l'accueil
      </Link>
    </section>
  );
}
