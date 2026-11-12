import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, ErrorAlert, Field, Input } from '../../components/ui';
import { AUTH_BUTTON, AUTH_FORM, AUTH_INPUT, AUTH_SECONDARY, AuthBrand, AuthFrame } from '../../components/AuthLayout';
import { EyeIcon, EyeOffIcon } from '../../components/Icons';
import { useAuth } from '../../lib/auth';
import { homeFor } from '../../lib/routes';

export function LoginPage() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        <div className="tiny:sr-only">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Connexion</h1>
          <p className="mt-1 text-sm text-slate-500 short:hidden">Accédez à votre espace avec vos identifiants.</p>
        </div>
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
            <div className="relative">
              <Input
                id={id}
                className={`${AUTH_INPUT} pr-10`}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-slate-400 transition-colors hover:text-slate-700"
              >
                {showPassword ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
              </button>
            </div>
          )}
        </Field>
        <Button type="submit" loading={pending} className={AUTH_BUTTON}>
          Se connecter
        </Button>
        <p className={`text-center text-xs leading-snug text-slate-500 ${AUTH_SECONDARY}`}>Mot de passe oublié ? Adressez-vous à l'administration du système.</p>
        <p className={`border-t border-slate-200 pt-3 text-center text-xs ${AUTH_SECONDARY} short:hidden`}>
          <Link to="/" className="font-medium text-upl-blue-700 hover:underline">
            ← Retour à l'accueil du portail
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}
