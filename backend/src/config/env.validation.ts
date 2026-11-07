/**
 * Validation des variables d'environnement au démarrage.
 * L'API refuse de démarrer si une valeur manque, est mal formée ou n'a pas été changée.
 * Module sans dépendance : il est testé seul (test/unit/env.validation.test.ts).
 */
import { assertValidTimeZone } from '../domain/time/zoned-time';

export interface AppEnv {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  CORS_ORIGINS: string[];
  DATABASE_URL: string;
  APP_TIMEZONE: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL_SECONDS: number;
  JWT_REFRESH_TTL_DAYS: number;
  QR_TOKEN_ENCRYPTION_KEY: Buffer;
  SWAGGER_ENABLED: boolean;
  /** Dossier des photos (hors du dossier web). */
  STORAGE_DIR: string;
  /** Active la clôture automatique des sessions (désactivée pendant les tests). */
  CLOSURE_JOB_ENABLED: boolean;
}

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const errors: string[] = [];
  const str = (name: string, fallback?: string): string => {
    const value = raw[name];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (fallback !== undefined) return fallback;
    errors.push(`${name} est obligatoire`);
    return '';
  };
  const int = (name: string, fallback: number, min: number, max: number): number => {
    const value = raw[name];
    if (value === undefined || value === '') return fallback;
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) {
      errors.push(`${name} doit être un entier entre ${min} et ${max}`);
      return fallback;
    }
    return n;
  };
  const secret = (name: string): string => {
    const value = str(name);
    if (value && (value.length < 32 || value.startsWith('CHANGER'))) {
      errors.push(`${name} doit contenir au moins 32 caractères aléatoires (valeur d'exemple non modifiée ?)`);
    }
    return value;
  };

  const nodeEnv = str('NODE_ENV', 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    errors.push('NODE_ENV doit valoir development, test ou production');
  }

  const databaseUrl = str('DATABASE_URL');
  if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    errors.push('DATABASE_URL doit être une URL postgresql://');
  }

  const timeZone = str('APP_TIMEZONE', 'Africa/Lubumbashi');
  try {
    assertValidTimeZone(timeZone);
  } catch (e) {
    errors.push((e as Error).message);
  }

  const accessSecret = secret('JWT_ACCESS_SECRET');
  const refreshSecret = secret('JWT_REFRESH_SECRET');
  if (accessSecret && accessSecret === refreshSecret) {
    errors.push('JWT_ACCESS_SECRET et JWT_REFRESH_SECRET doivent être différents');
  }

  const keyText = str('QR_TOKEN_ENCRYPTION_KEY');
  let key = Buffer.alloc(0);
  if (keyText) {
    key = Buffer.from(keyText, 'base64');
    if (key.length !== 32) errors.push('QR_TOKEN_ENCRYPTION_KEY doit encoder exactement 32 octets en base64');
  }

  const origins = str('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  for (const origin of origins) {
    if (!/^https?:\/\/[^/\s]+$/.test(origin)) errors.push(`Origine CORS invalide : ${origin}`);
  }

  const env: AppEnv = {
    NODE_ENV: nodeEnv as AppEnv['NODE_ENV'],
    PORT: int('PORT', 3000, 1, 65535),
    CORS_ORIGINS: origins,
    DATABASE_URL: databaseUrl,
    APP_TIMEZONE: timeZone,
    JWT_ACCESS_SECRET: accessSecret,
    JWT_REFRESH_SECRET: refreshSecret,
    JWT_ACCESS_TTL_SECONDS: int('JWT_ACCESS_TTL_SECONDS', 900, 60, 3600),
    JWT_REFRESH_TTL_DAYS: int('JWT_REFRESH_TTL_DAYS', 7, 1, 30),
    QR_TOKEN_ENCRYPTION_KEY: key,
    SWAGGER_ENABLED: str('SWAGGER_ENABLED', nodeEnv === 'production' ? 'false' : 'true') === 'true',
    STORAGE_DIR: str('STORAGE_DIR', './storage'),
    CLOSURE_JOB_ENABLED: str('CLOSURE_JOB_ENABLED', nodeEnv === 'test' ? 'false' : 'true') === 'true',
  };

  if (errors.length > 0) {
    throw new Error(`Configuration invalide :\n - ${errors.join('\n - ')}`);
  }
  return env;
}
