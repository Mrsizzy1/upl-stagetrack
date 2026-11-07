// Exécute test/sql/*.test.sql sur la base de test (DATABASE_URL_TEST).
// Utilise `psql` s'il est installé, sinon le psql du conteneur Docker `upl_stagetrack_db`.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// psql refuse le paramètre `?schema=` propre à Prisma : on retire la chaîne de requête.
const url = process.env.DATABASE_URL_TEST?.split('?')[0];
if (!url) {
  console.error('DATABASE_URL_TEST est requise (voir backend/.env.example)');
  process.exit(1);
}

const dir = join(import.meta.dirname, '..', 'test', 'sql');
const files = readdirSync(dir).filter((f) => f.endsWith('.test.sql')).sort();
let failed = false;

for (const file of files) {
  const sql = readFileSync(join(dir, file));
  console.log(`\n▶ ${file}`);
  let run = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'], { input: sql, stdio: ['pipe', 'inherit', 'inherit'] });
  if (run.error && run.error.code === 'ENOENT') {
    // psql absent de la machine : passage par le conteneur, connexion locale au conteneur.
    const containerUrl = url.replace(/@[^/]+\//, '@localhost:5432/');
    run = spawnSync('docker', ['exec', '-i', 'upl_stagetrack_db', 'psql', containerUrl, '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'], {
      input: sql,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
  }
  if (run.error || run.status !== 0) {
    failed = true;
    console.error(`✖ ${file} a échoué`);
  }
}

process.exit(failed ? 1 : 0);
