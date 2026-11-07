/**
 * Limitation des tentatives de connexion par couple (identifiant, adresse IP) — module pur, en mémoire.
 *
 * Chaque tentative est comptée AVANT la vérification du mot de passe : des requêtes envoyées
 * en parallèle ne peuvent pas dépasser la limite. Un tiers qui se trompe sur le compte d'un agent
 * ne bloque que sa propre adresse, pas l'agent qui se connecte depuis son poste.
 *
 * Mémoire du processus : suffisant pour une API à instance unique (déploiement actuel).
 */
export interface ThrottleDecision {
  allowed: boolean;
  /** Fin du blocage si la tentative est refusée. */
  retryAt: Date | null;
}

interface Entry {
  attempts: number;
  windowEndsAt: number;
  blockedUntil: number | null;
}

export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
    private readonly blockMs: number,
  ) {}

  static key(username: string, ip: string | null): string {
    return `${username}|${ip ?? 'inconnue'}`;
  }

  /** Réserve une tentative. Refusée si la source est bloquée ou si elle dépasse la limite. */
  attempt(key: string, now: Date): ThrottleDecision {
    const t = now.getTime();
    this.prune(t);
    let entry = this.entries.get(key);
    if (entry?.blockedUntil && entry.blockedUntil > t) return { allowed: false, retryAt: new Date(entry.blockedUntil) };
    if (!entry || entry.windowEndsAt <= t || entry.blockedUntil) {
      entry = { attempts: 0, windowEndsAt: t + this.windowMs, blockedUntil: null };
      this.entries.set(key, entry);
    }
    entry.attempts++;
    if (entry.attempts > this.maxAttempts) {
      entry.blockedUntil = t + this.blockMs;
      return { allowed: false, retryAt: new Date(entry.blockedUntil) };
    }
    return { allowed: true, retryAt: null };
  }

  /** Connexion réussie : le compteur de cette source repart de zéro. */
  reset(key: string): void {
    this.entries.delete(key);
  }

  private prune(t: number): void {
    if (this.entries.size < 10_000) return;
    for (const [k, e] of this.entries) {
      if (e.windowEndsAt <= t && (!e.blockedUntil || e.blockedUntil <= t)) this.entries.delete(k);
    }
  }
}

/** Exécute les tâches portant la même clé l'une après l'autre (rotation d'un même jeton). */
export class KeyedMutex {
  private readonly tails = new Map<string, Promise<unknown>>();

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    this.tails.set(key, current);
    try {
      return await current;
    } finally {
      if (this.tails.get(key) === current) this.tails.delete(key);
    }
  }
}
