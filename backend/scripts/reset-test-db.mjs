// Remet la base de TEST à zéro (supprime le schéma, rejoue les migrations) avant les tests d'intégration.
// Refuse de toucher une base dont l'URL ne contient pas « test ».
import { spawnSync } from 'node:child_process';

const url = process.env.DATABASE_URL_TEST;
if (!url || !/test/i.test(new URL(url).pathname)) {
  console.error('DATABASE_URL_TEST absente ou ne désignant pas une base de test : arrêt.');
  process.exit(1);
}
const run = spawnSync('npx', ['prisma', 'migrate', 'reset', '--force'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
  shell: process.platform === 'win32',
});
process.exit(run.status ?? 1);
