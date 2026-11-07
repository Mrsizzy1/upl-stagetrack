import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { describeNextOpening, formatLongDate, formatWeekdays } from '../../src/domain/attendance/schedule-rules';
import { isDatabaseUnavailable } from '../../src/common/filters/all-exceptions.filter';

describe('Jours de pointage en toutes lettres', () => {
  it('plage continue, jour seul, liste, semaine complète', () => {
    assert.equal(formatWeekdays([1, 2, 3, 4, 5]), 'du lundi au vendredi');
    assert.equal(formatWeekdays([6]), 'le samedi');
    assert.equal(formatWeekdays([1, 3, 5]), 'lundi, mercredi et vendredi');
    assert.equal(formatWeekdays([6, 7]), 'samedi et dimanche');
    assert.equal(formatWeekdays([1, 2, 3, 4, 5, 6, 7]), 'tous les jours');
    assert.equal(formatWeekdays([5, 1, 2, 3, 4, 1]), 'du lundi au vendredi');
  });
});

describe('Prochaine session', () => {
  const next = { date: '2026-11-09', isoWeekday: 1, sessionType: 'MORNING' as const, opensAtMinute: 465, closesAtMinute: 525 };

  it('date longue en français', () => {
    assert.equal(formatLongDate('2026-11-09', 1), 'lundi 9 novembre');
    assert.equal(formatLongDate('2027-02-01', 1), 'lundi 1 février');
  });

  it("aujourd'hui, demain ou date complète", () => {
    assert.equal(describeNextOpening(next, '2026-11-07', '2026-11-08'), "Prochaine session : lundi 9 novembre à 07h45 (matin, jusqu'à 08h45).");
    assert.equal(describeNextOpening(next, '2026-11-08', '2026-11-09'), "Prochaine session : demain (lundi 9 novembre) à 07h45 (matin, jusqu'à 08h45).");
    assert.equal(
      describeNextOpening({ ...next, sessionType: 'EVENING', opensAtMinute: 1020, closesAtMinute: 1050 }, '2026-11-09', '2026-11-10'),
      "Prochaine session : aujourd'hui à 17h00 (soir, jusqu'à 17h30).",
    );
    assert.match(describeNextOpening(null, '2026-11-09', '2026-11-10'), /Aucune session programmée/);
  });
});

describe('Base de données injoignable', () => {
  it('reconnaît les erreurs de connexion Prisma', () => {
    assert.equal(isDatabaseUnavailable(new Prisma.PrismaClientInitializationError("Can't reach database server at `localhost:5434`", '6.19.3')), true);
    assert.equal(
      isDatabaseUnavailable(new Prisma.PrismaClientKnownRequestError("Can't reach database server at `localhost:5434`", { code: 'P1001', clientVersion: '6.19.3' })),
      true,
    );
    assert.equal(isDatabaseUnavailable(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.3' })), false);
    assert.equal(isDatabaseUnavailable(new Error('autre')), false);
  });
});
