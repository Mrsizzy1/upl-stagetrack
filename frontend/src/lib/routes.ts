import type { Role } from './types';

/** Page d'accueil de chaque rôle. */
export function homeFor(role: Role): string {
  return role === 'SCAN_AGENT' ? '/pointage' : role === 'STUDENT' ? '/mon-espace' : '/tableau-de-bord';
}
