import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, ErrorAlert, Field, Input } from '../../components/ui';
import { AUTH_BUTTON, AUTH_FORM, AUTH_INPUT, AUTH_SECONDARY, AuthBrand, AuthFrame } from '../../components/AuthLayout';
import { useAuth } from '../../lib/auth';
import { homeFor } from '../../lib/routes';

export function LoginPage() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (state.status === 'authenticated') {
      const dest = state.user.mustChangePassword ? '/changer-mot-de-passe' : homeFor(state.user.role);
      navigate(dest, { replace: true });
    }
  }, [state, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(username, password);
      // La transition d'état vers 'authenticated' déclenche automatiquement la navigation via le useEffect ci-dessus
    } catch (err) {
      setError(err);
      setPassword('');
      setPending(false);
    }
  }

  return (
    <AuthFrame>
      <AuthBrand subtitle="Gestion des présences des stagiaires" />
      <form onSubmit={submit} className={AUTH_FORM}>
        <h1 className="text-base font-semibold text-upl-blue-900 tiny:sr-only">Connexion</h1>
        <ErrorAlert error={error} />
        <Field label="Identifiant" hint="Étudiants : votre matricule" required>
          {(id) => (
            <Input
              id={id}
              className={AUTH_INPUT}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          )}
        </Field>
        <Field label="Mot de passe" required>
          {(id) => (
            <Input
              id={id}
              className={AUTH_INPUT}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
        </Field>
        <Button type="submit" loading={pending} className={AUTH_BUTTON}>
          Se connecter
        </Button>
        <p className={`text-center text-[11px] leading-snug text-upl-blue-800 ${AUTH_SECONDARY}`}>Mot de passe oublié : adressez-vous à l'administration du système.</p>
      </form>
    </AuthFrame>
  );
}
