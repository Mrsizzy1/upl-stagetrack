/**
 * Test d'intégration : API NestJS réelle + base PostgreSQL de test (DATABASE_URL_TEST).
 * Prérequis : `npm run db:up` à la racine, puis migrations appliquées sur la base de test :
 *   DATABASE_URL=$DATABASE_URL_TEST npx prisma migrate deploy
 */
import './test-env'; // doit rester le premier import
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { Clock, FixedClock } from '../../src/common/clock/clock';

describe('GET /api/health', () => {
  let app: INestApplication;
  const clock = new FixedClock(new Date('2026-11-09T05:45:30Z'));

  before(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue(clock)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  after(async () => {
    await app?.close();
  });

  it("renvoie l'heure du serveur convertie en heure de Lubumbashi", async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.database, 'up');
    assert.equal(res.body.serverTime, '2026-11-09T05:45:30.000Z');
    assert.equal(res.body.localDate, '2026-11-09');
    assert.equal(res.body.localTime, '07:45:30');
  });

  it("ignore toute heure envoyée par le client", async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .set('Date', 'Mon, 09 Nov 2026 12:00:00 GMT')
      .expect(200);
    assert.equal(res.body.localTime, '07:45:30');
  });

  it('répond 404 au format d\'erreur commun', async () => {
    const res = await request(app.getHttpServer()).get('/api/inexistant').expect(404);
    assert.equal(res.body.code, 'NOT_FOUND');
    assert.equal(typeof res.body.message, 'string');
  });
});
