/**
 * Paramètres Argon2id communs au seed et au module d'authentification.
 * Valeurs de la recommandation OWASP (2024) : 19 Mio de mémoire, 2 itérations, 1 fil.
 * À relever si le serveur de l'UPL le permet (mesurer : viser 250–500 ms par hachage).
 */
export const ARGON2_OPTIONS = {
  type: 2, // argon2.argon2id (valeur littérale pour éviter d'importer le module natif ici)
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;
