import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KeyedMutex, LoginThrottle } from '../../src/auth/login-throttle';
import { detectCsvDelimiter } from '../../src/domain/students/import-rows';

const t0 = new Date('2026-11-09T07:00:00Z');
const plus = (min: number) => new Date(t0.getTime() + min * 60_000);

describe('Limitation des tentatives de connexion', () => {
  it('accepte 5 tentatives puis bloque la source 15 minutes', () => {
    const th = new LoginThrottle(5, 15 * 60_000, 15 * 60_000);
    const key = LoginThrottle.key('agent', '10.0.0.1');
    for (let i = 0; i < 5; i++) assert.equal(th.attempt(key, t0).allowed, true);
    const refused = th.attempt(key, t0);
    assert.equal(refused.allowed, false);
    assert.deepEqual(refused.retryAt, plus(15));
    assert.equal(th.attempt(key, plus(14)).allowed, false);
    assert.equal(th.attempt(key, plus(15)).allowed, true);
  });

  it("le blocage d'une adresse ne touche pas le même compte depuis une autre adresse", () => {
    const th = new LoginThrottle(5, 15 * 60_000, 15 * 60_000);
    for (let i = 0; i < 6; i++) th.attempt(LoginThrottle.key('agent', '203.0.113.7'), t0);
    assert.equal(th.attempt(LoginThrottle.key('agent', '203.0.113.7'), t0).allowed, false);
    assert.equal(th.attempt(LoginThrottle.key('agent', '10.0.0.1'), t0).allowed, true);
  });

  it('une connexion réussie remet le compteur de la source à zéro', () => {
    const th = new LoginThrottle(5, 15 * 60_000, 15 * 60_000);
    const key = LoginThrottle.key('resp', '10.0.0.2');
    for (let i = 0; i < 4; i++) th.attempt(key, t0);
    th.reset(key);
    for (let i = 0; i < 5; i++) assert.equal(th.attempt(key, t0).allowed, true);
  });

  it('la fenêtre de comptage expire', () => {
    const th = new LoginThrottle(5, 15 * 60_000, 15 * 60_000);
    const key = LoginThrottle.key('resp', null);
    for (let i = 0; i < 5; i++) th.attempt(key, t0);
    assert.equal(th.attempt(key, plus(16)).allowed, true);
  });
});

describe('Exécution en série par clé', () => {
  it('deux tâches de même clé ne se chevauchent pas', async () => {
    const mutex = new KeyedMutex();
    const order: string[] = [];
    const task = (name: string) => async () => {
      order.push(`${name}:début`);
      await new Promise((r) => setTimeout(r, 10));
      order.push(`${name}:fin`);
    };
    await Promise.all([mutex.run('k', task('a')), mutex.run('k', task('b'))]);
    assert.deepEqual(order, ['a:début', 'a:fin', 'b:début', 'b:fin']);
  });

  it("l'échec d'une tâche ne bloque pas la suivante", async () => {
    const mutex = new KeyedMutex();
    await assert.rejects(mutex.run('k', async () => { throw new Error('x'); }));
    assert.equal(await mutex.run('k', async () => 42), 42);
  });
});

describe("Séparateur d'un import CSV", () => {
  it('détecte le point-virgule et garde la virgule dans un champ', () => {
    assert.equal(detectCsvDelimiter(Buffer.from('matricule;nom;service_accueil\nA1;KABONGO;Direction, finances\n')), ';');
  });
  it('détecte la virgule et la tabulation', () => {
    assert.equal(detectCsvDelimiter(Buffer.from('matricule,nom,prenom\n')), ',');
    assert.equal(detectCsvDelimiter(Buffer.from('matricule\tnom\tprenom\n')), '\t');
  });
  it('ignore les séparateurs entre guillemets et prend « ; » par défaut', () => {
    assert.equal(detectCsvDelimiter(Buffer.from('"a,b,c";"d"\n')), ';');
    assert.equal(detectCsvDelimiter(Buffer.from('matricule\n')), ';');
  });
});
