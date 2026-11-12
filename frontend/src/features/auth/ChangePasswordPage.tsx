import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { AUTH_FORM, AUTH_INPUT, AuthBrand, AuthFrame } from '../../components/AuthLayout';
import { Alert, Button, ErrorAlert, Field, Input, Loading } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export function ChangePasswordPage() {
  const { state, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'anonymous') return <Navigate to="/connexion" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMismatch(next !== confirm);
    if (next !== confirm) return;
    setPending(true);
    setError(null);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      // Toutes les sessions sont fermées par le serveur : reconnexion avec le nouveau mot de passe.
      await logout();
      navigate('/connexion', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame>
      <AuthBrand />
      <form onSubmit={submit} className={AUTH_FORM}>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Changer le mot de passe</h1>
        {state.user.mustChangePassword && (
          <Alert tone="warning">Votre mot de passe est provisoire : choisissez-en un nouveau pour continuer.</Alert>
        )}
        <ErrorAlert error={error} />
        <Field label="Mot de passe actuel" required>
          {(id) => <Input id={id} className={AUTH_INPUT} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />}
        </Field>
        <Field label="Nouveau mot de passe" hint="10 caractères minimum, au moins une lettre et un chiffre" required>
          {(id) => <Input id={id} className={AUTH_INPUT} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={10} />}
        </Field>
        <Field label="Confirmer le nouveau mot de passe" error={mismatch ? 'Les deux mots de passe diffèrent' : null} required>
          {(id) => <Input id={id} className={AUTH_INPUT} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />}
        </Field>
        <div className="flex gap-2">
          <Button type="submit" loading={pending} className="py-2">
            Enregistrer
          </Button>
          <Button variant="ghost" onClick={() => void logout()}>
            Se déconnecter
          </Button>
        </div>
      </form>
    </AuthFrame>
  );
}
