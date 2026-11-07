import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { checkPasswordPolicy, normalizeUsername } from '../../src/common/security/password-policy';
import {
  encodeQrPayload,
  generateToken,
  hashToken,
  openToken,
  parseQrPayload,
  sealToken,
} from '../../src/domain/qr/qr-token';
import { attendanceRate, periodRange } from '../../src/domain/reports/periods';
import { addDays, isoWeekdayOf } from '../../src/common/dates';
import {
  ImportLookups,
  missingColumns,
  normalizeHeader,
  parseFlexibleDate,
  validateImportRows,
} from '../../src/domain/students/import-rows';

describe('Politique de mot de passe', () => {
  it('accepte un mot de passe conforme', () => {
    assert.deepEqual(checkPasswordPolicy('Lubumbashi2026', 'agent1'), []);
  });
  it('refuse trop court, sans chiffre, ou contenant l\'identifiant', () => {
    assert.ok(checkPasswordPolicy('abc1').length > 0);
    assert.ok(checkPasswordPolicy('motdepasselong').some((e) => e.includes('chiffre')));
    assert.ok(checkPasswordPolicy('kabila2026xx', 'kabila').some((e) => e.includes('identifiant')));
  });
  it('normalise les identifiants', () => {
    assert.equal(normalizeUsername('  Admin '), 'admin');
  });
});

describe('Jetons QR', () => {
  const key = randomBytes(32);

  it('le QR ne contient que le préfixe et un jeton opaque de 43 caractères', () => {
    const token = generateToken();
    const payload = encodeQrPayload(token);
    assert.match(payload, /^UPLST1\.[A-Za-z0-9_-]{43}$/);
    assert.equal(parseQrPayload(payload), token);
  });
  it('rejette les textes étrangers ou modifiés', () => {
    assert.equal(parseQrPayload('MAT-2024-001'), null);
    assert.equal(parseQrPayload('UPLST1.court'), null);
    assert.equal(parseQrPayload(`UPLST1.${'a'.repeat(42)}!`), null);
  });
  it("l'empreinte est stable et au format attendu par la base", () => {
    const token = generateToken();
    assert.equal(hashToken(token), hashToken(token));
    assert.match(hashToken(token), /^[0-9a-f]{64}$/);
  });
  it('chiffre puis déchiffre ; refuse une donnée altérée ou une autre clé', () => {
    const token = generateToken();
    const sealed = sealToken(token, key);
    assert.equal(openToken(sealed, key), token);
    assert.notEqual(sealToken(token, key), sealed); // IV aléatoire
    assert.throws(() => openToken(sealed, randomBytes(32)));
    const [iv, tag, data] = sealed.split('.');
    const tampered = [iv, tag, Buffer.from('x' + data).toString('base64url')].join('.');
    assert.throws(() => openToken(tampered, key));
  });
});

describe('Périodes de rapport', () => {
  it('journalière, hebdomadaire (lundi–dimanche), mensuelle', () => {
    assert.deepEqual(periodRange('daily', '2026-11-11'), { from: '2026-11-11', to: '2026-11-11' });
    assert.deepEqual(periodRange('weekly', '2026-11-11'), { from: '2026-11-09', to: '2026-11-15' });
    assert.deepEqual(periodRange('weekly', '2026-11-15'), { from: '2026-11-09', to: '2026-11-15' });
    assert.deepEqual(periodRange('monthly', '2026-02-14'), { from: '2026-02-01', to: '2026-02-28' });
    assert.deepEqual(periodRange('monthly', '2026-12-31'), { from: '2026-12-01', to: '2026-12-31' });
  });
  it('période personnalisée bornée', () => {
    assert.throws(() => periodRange('custom', '2026-11-10', '2026-11-01'));
    assert.throws(() => periodRange('custom', '2025-01-01', '2026-11-01'));
  });
  it('taux de présence', () => {
    assert.equal(attendanceRate(8, 1, 1), 90);
    assert.equal(attendanceRate(0, 0, 0), null);
    assert.equal(attendanceRate(1, 0, 2), 33.3);
  });
  it('dates calendaires', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(isoWeekdayOf('2026-11-08'), 7);
    assert.equal(isoWeekdayOf('2026-11-09'), 1);
  });
});

describe("Import d'étudiants", () => {
  const lookups: ImportLookups = {
    faculties: new Map([['FSE', 'fac-1']]),
    departments: new Map([['FSE|ECO', 'dep-1']]),
    promotions: new Map([['L2', 'promo-1']]),
    existingMatricules: new Set(['UPL-0001']),
  };
  const row = (overrides: Record<string, unknown> = {}) => ({
    Matricule: 'upl-0100',
    Nom: 'Ilunga',
    Postnom: 'Kasongo',
    Prénom: 'Esther',
    Faculté: 'fse',
    Département: 'eco',
    Promotion: 'L2',
    'Date inscription': '01/10/2025',
    'Début stage': '2026-11-02',
    'Fin stage': '18/12/2026',
    ...overrides,
  });

  it('normalise les entêtes avec accents et espaces', () => {
    assert.equal(normalizeHeader(' Prénom '), 'prenom');
    assert.equal(normalizeHeader("Date d'inscription"), 'date_inscription');
    assert.equal(normalizeHeader('Département'), 'departement');
    assert.deepEqual(missingColumns(['Matricule', 'Nom']).includes('postnom'), true);
  });
  it('lit les dates JJ/MM/AAAA, AAAA-MM-JJ et Excel', () => {
    assert.equal(parseFlexibleDate('02/11/2026'), '2026-11-02');
    assert.equal(parseFlexibleDate('2026-11-02'), '2026-11-02');
    assert.equal(parseFlexibleDate(new Date(Date.UTC(2026, 10, 2))), '2026-11-02');
    assert.equal(parseFlexibleDate('31/02/2026'), 'invalid');
    assert.equal(parseFlexibleDate(''), null);
  });
  it('accepte une ligne valide et résout les codes', () => {
    const { rows, errors } = validateImportRows([row()], lookups);
    assert.deepEqual(errors, []);
    assert.equal(rows[0].matricule, 'UPL-0100');
    assert.equal(rows[0].departmentId, 'dep-1');
    assert.deepEqual(rows[0].internship, { startDate: '2026-11-02', endDate: '2026-12-18', hostService: null });
  });
  it('signale chaque erreur avec sa ligne et sa colonne', () => {
    const { rows, errors } = validateImportRows(
      [row(), row({ Matricule: 'UPL-0100' }), row({ Matricule: 'UPL-0001', Faculté: 'XXX', 'Fin stage': '' })],
      lookups,
    );
    assert.equal(rows.length, 1);
    assert.ok(errors.some((e) => e.line === 3 && e.message.includes('double')));
    assert.ok(errors.some((e) => e.line === 4 && e.message.includes('déjà inscrit')));
    assert.ok(errors.some((e) => e.line === 4 && e.column === 'faculte'));
    assert.ok(errors.some((e) => e.line === 4 && e.column === 'fin_stage'));
  });
  it('ignore les lignes vides', () => {
    const { rows, errors } = validateImportRows([row(), { Matricule: '', Nom: '' }], lookups);
    assert.equal(rows.length, 1);
    assert.equal(errors.length, 0);
  });
});
