import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { validateEnv } from '../../src/config/env.validation';

const valid = () => ({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'),
  JWT_REFRESH_SECRET: randomBytes(48).toString('base64url'),
  QR_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
});

describe('validateEnv', () => {
  it('accepte une configuration complète et applique les valeurs par défaut', () => {
    const env = validateEnv(valid());
    assert.equal(env.APP_TIMEZONE, 'Africa/Lubumbashi');
    assert.equal(env.PORT, 3000);
    assert.equal(env.QR_TOKEN_ENCRYPTION_KEY.length, 32);
    assert.deepEqual(env.CORS_ORIGINS, ['http://localhost:5173']);
  });

  it('refuse les secrets d\'exemple non modifiés', () => {
    assert.throws(() => validateEnv({ ...valid(), JWT_ACCESS_SECRET: 'CHANGER_secret_acces_32_caracteres_minimum' }), /JWT_ACCESS_SECRET/);
  });

  it('refuse deux secrets JWT identiques', () => {
    const s = randomBytes(48).toString('base64url');
    assert.throws(() => validateEnv({ ...valid(), JWT_ACCESS_SECRET: s, JWT_REFRESH_SECRET: s }), /différents/);
  });

  it('refuse une clé de chiffrement QR qui ne fait pas 32 octets', () => {
    assert.throws(() => validateEnv({ ...valid(), QR_TOKEN_ENCRYPTION_KEY: randomBytes(16).toString('base64') }), /32 octets/);
  });

  it('refuse un fuseau inconnu', () => {
    assert.throws(() => validateEnv({ ...valid(), APP_TIMEZONE: 'Lubumbashi' }), /Fuseau/);
  });

  it('refuse une base qui n\'est pas PostgreSQL', () => {
    assert.throws(() => validateEnv({ ...valid(), DATABASE_URL: 'mysql://x' }), /postgresql/);
  });

  it('liste toutes les erreurs en une fois', () => {
    try {
      validateEnv({});
      assert.fail('aurait dû échouer');
    } catch (e) {
      const message = (e as Error).message;
      assert.match(message, /DATABASE_URL/);
      assert.match(message, /JWT_ACCESS_SECRET/);
      assert.match(message, /QR_TOKEN_ENCRYPTION_KEY/);
    }
  });
});
