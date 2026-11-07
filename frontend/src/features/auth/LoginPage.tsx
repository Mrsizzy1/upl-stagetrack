import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Button, ErrorAlert, Field, Input } from '../../components/ui';
import { AuthBrand, AuthFrame } from '../../components/AuthLayout';
import { useAuth } from '../../lib/auth';
import { homeFor } from '../../lib/routes';

export function LoginPage() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  if (state.status === 'authenticated') {
    return <Navigate to={state.user.mustChangePassword ? '/changer-mot-de-passe' : homeFor(state.user.role)} replace />;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const user = await login(username, password);
      navigate(user.mustChangePassword ? '/changer-mot-de-passe' : homeFor(user.role), { replace: true });
    } catch (err) {
      setError(err);
      setPassword('');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame>
      <AuthBrand subtitle="Gestion des présences des stagiaires" />
      <form onSubmit={submit} className="mt-8 space-y-4">
        <h1 className="text-lg font-semibold text-upl-blue-900">Connexion</h1>
        <ErrorAlert error={error} />
        <Field label="Identifiant" hint="Étudiants : votre matricule" required>
          {(id) => (
            <Input id={id} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          )}
        </Field>
        <Field label="Mot de passe" required>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
        </Field>
        <Button type="submit" loading={pending} className="w-full py-2.5">
          Se connecter
        </Button>
        <p className="text-center text-xs text-upl-blue-800">Mot de passe oublié : adressez-vous à l'administration du système.</p>
      </form>
    </AuthFrame>
  );
}
