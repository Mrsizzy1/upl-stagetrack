/**
 * Prépare l'environnement des tests d'intégration : base de test séparée, secrets éphémères.
 *
 * S'exécute dès son import. Il doit être le PREMIER import de chaque fichier de test
 * d'intégration : ConfigModule.forRoot lit et valide process.env au chargement d'AppModule.
 *
 * Refuse de tourner si DATABASE_URL_TEST est absente ou désigne la même base que DATABASE_URL.
 */
import { randomBytes } from 'node:crypto';

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  throw new Error("DATABASE_URL_TEST est requise pour les tests d'intégration (voir backend/.env.example)");
}
if (process.env.DATABASE_URL && process.env.DATABASE_URL === testUrl) {
  throw new Error('DATABASE_URL_TEST doit désigner une base distincte de DATABASE_URL');
}
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
process.env.SWAGGER_ENABLED = 'false';
// La clôture est déclenchée explicitement par les tests, jamais par la tâche planifiée.
process.env.CLOSURE_JOB_ENABLED = 'false';
process.env.STORAGE_DIR = process.env.STORAGE_DIR_TEST ?? './storage-test';
process.env.JWT_ACCESS_SECRET = randomBytes(48).toString('base64url');
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('base64url');
process.env.QR_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
