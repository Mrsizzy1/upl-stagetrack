/**
 * Politique de mot de passe (module pur).
 * Au moins 10 caractères, une lettre et un chiffre, différent de l'identifiant.
 * Hypothèse technique, modifiable si l'UPL a sa propre politique.
 */
export const PASSWORD_MIN_LENGTH = 10;

export function checkPasswordPolicy(password: string, username?: string): string[] {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`);
  }
  if (password.length > 128) errors.push('Le mot de passe ne doit pas dépasser 128 caractères');
  if (!/\p{L}/u.test(password)) errors.push('Le mot de passe doit contenir au moins une lettre');
  if (!/\d/.test(password)) errors.push('Le mot de passe doit contenir au moins un chiffre');
  if (username && password.toLowerCase().includes(username.toLowerCase())) {
    errors.push("Le mot de passe ne doit pas contenir l'identifiant");
  }
  return errors;
}

/** Normalise un identifiant de connexion : sans espaces, en minuscules. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}
