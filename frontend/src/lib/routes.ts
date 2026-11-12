import type { Role } from './types';

/** Page d'accueil par rôle pour la redirection après connexion. */
export function homeFor(role: Role): string {
  switch (role) {
    case 'STUDENT':
    case 'INTERN':
      return '/mon-espace';
    case 'SCAN_AGENT':
      return '/pointage';
    case 'IT_TECHNICIAN':
      return '/parc/technicien';
    case 'SUPERVISOR':
    case 'INTERNSHIP_MANAGER':
      return '/tableau-de-bord';
    case 'FACULTY_ADMIN':
    case 'ADMIN':
    case 'SUPER_ADMIN':
    default:
      return '/hub';
  }
}

