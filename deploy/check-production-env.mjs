import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.argv[2] ?? 'deploy/.env.production');
const values = Object.create(null);

for (const [index, rawLine] of readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const separator = line.indexOf('=');
  if (separator < 1) throw new Error(`${file}:${index + 1}: attendu CLE=VALEUR`);
  const key = line.slice(0, separator).trim();
  const value = line.slice(separator + 1).trim();
  if (Object.hasOwn(values, key)) throw new Error(`${file}:${index + 1}: variable dupliquée ${key}`);
  values[key] = value;
}

const required = [
  'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'APP_DB_PASSWORD',
  'MIGRATOR_DB_PASSWORD', 'APP_BASE_URL', 'CORS_ORIGINS', 'APP_TIMEZONE',
  'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'JWT_ACCESS_TTL_SECONDS',
  'JWT_REFRESH_TTL_DAYS', 'QR_TOKEN_ENCRYPTION_KEY', 'SWAGGER_ENABLED',
  'CLOSURE_JOB_ENABLED',
];

for (const key of required) {
  const value = values[key];
  if (!value || value.startsWith('CHANGER')) throw new Error(`${key} est absent ou contient encore une valeur d'exemple`);
}

const databasePasswords = ['POSTGRES_PASSWORD', 'APP_DB_PASSWORD', 'MIGRATOR_DB_PASSWORD'].map((key) => values[key]);
if (new Set(databasePasswords).size !== databasePasswords.length) {
  throw new Error('Les mots de passe PostgreSQL administrateur, API et migration doivent être différents');
}
for (const [index, password] of databasePasswords.entries()) {
  if (password.length < 32 || !/^[A-Za-z0-9_-]+$/.test(password)) {
    throw new Error(`${['POSTGRES_PASSWORD', 'APP_DB_PASSWORD', 'MIGRATOR_DB_PASSWORD'][index]} doit être un secret base64url d'au moins 32 caractères`);
  }
}

if (['stagetrack_app', 'stagetrack_migrator'].includes(values.POSTGRES_USER)) {
  throw new Error('POSTGRES_USER doit rester distinct des rôles stagetrack_app et stagetrack_migrator');
}
if (!/^[a-z][a-z0-9_]*$/.test(values.POSTGRES_DB)) throw new Error('POSTGRES_DB doit être un identifiant PostgreSQL simple');

const appUrl = new URL(values.APP_BASE_URL);
if (appUrl.protocol !== 'https:' || appUrl.pathname !== '/' || appUrl.search || appUrl.hash) {
  throw new Error('APP_BASE_URL doit être une origine HTTPS sans chemin, paramètres ni fragment');
}
const corsOrigins = values.CORS_ORIGINS.split(',').map((origin) => origin.trim());
if (!corsOrigins.includes(values.APP_BASE_URL)) throw new Error('APP_BASE_URL doit figurer dans CORS_ORIGINS');
for (const origin of corsOrigins) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Chaque origine de CORS_ORIGINS doit être HTTPS et ne contenir aucun chemin');
  }
}

if (values.JWT_ACCESS_SECRET.length < 32 || values.JWT_REFRESH_SECRET.length < 32 || values.JWT_ACCESS_SECRET === values.JWT_REFRESH_SECRET) {
  throw new Error('Les secrets JWT doivent être distincts et contenir au moins 32 caractères');
}
const accessTtl = Number(values.JWT_ACCESS_TTL_SECONDS);
const refreshTtl = Number(values.JWT_REFRESH_TTL_DAYS);
if (!Number.isInteger(accessTtl) || accessTtl < 60 || accessTtl > 3600) throw new Error('JWT_ACCESS_TTL_SECONDS doit être entre 60 et 3600');
if (!Number.isInteger(refreshTtl) || refreshTtl < 1 || refreshTtl > 30) throw new Error('JWT_REFRESH_TTL_DAYS doit être entre 1 et 30');
const qrKey = Buffer.from(values.QR_TOKEN_ENCRYPTION_KEY, 'base64');
if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(values.QR_TOKEN_ENCRYPTION_KEY)
    || qrKey.length !== 32 || qrKey.toString('base64') !== values.QR_TOKEN_ENCRYPTION_KEY) {
  throw new Error('QR_TOKEN_ENCRYPTION_KEY doit encoder exactement 32 octets en base64');
}
const seedValues = ['SEED_ADMIN_USERNAME', 'SEED_ADMIN_PASSWORD', 'SEED_ADMIN_FULLNAME'];
if (seedValues.some((key) => values[key])) {
  for (const key of seedValues) {
    if (!values[key] || values[key].startsWith('CHANGER')) throw new Error(`${key} est requis pour le premier amorçage et doit être remplacé`);
  }
  if (values.SEED_ADMIN_PASSWORD.length < 12) throw new Error('SEED_ADMIN_PASSWORD doit contenir au moins 12 caractères');
}
if (values.SWAGGER_ENABLED !== 'false') throw new Error('SWAGGER_ENABLED doit être false en production');
if (values.CLOSURE_JOB_ENABLED !== 'true') throw new Error('CLOSURE_JOB_ENABLED doit être true en production');
try {
  new Intl.DateTimeFormat('fr-FR', { timeZone: values.APP_TIMEZONE });
} catch {
  throw new Error('APP_TIMEZONE n’est pas un fuseau reconnu');
}

console.log(`Configuration de production valide : ${file}`);
