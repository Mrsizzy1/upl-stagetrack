/**
 * Source unique de l'heure dans l'API.
 * Aucun service ne doit appeler `new Date()` ou `Date.now()` directement pour une règle métier :
 * il injecte `Clock`. Les tests remplacent l'horloge par `FixedClock` pour simuler 07h44, 07h45, etc.
 */
export abstract class Clock {
  abstract now(): Date;
}

/** Horloge du serveur (synchronisée par NTP en production). */
export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}

/** Horloge réglable, réservée aux tests. */
export class FixedClock extends Clock {
  constructor(private current: Date) {
    super();
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(instant: Date): void {
    this.current = new Date(instant.getTime());
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
