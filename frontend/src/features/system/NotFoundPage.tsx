import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold text-upl-blue-900">Page introuvable</h1>
      <Link to="/" className="text-upl-blue-700 underline underline-offset-4">
        Retour à l'état du système
      </Link>
    </section>
  );
}
