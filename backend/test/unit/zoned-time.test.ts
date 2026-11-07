import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertValidTimeZone,
  formatMinuteOfDay,
  localToInstant,
  offsetMinutes,
  parseLocalDate,
  toLocal,
} from '../../src/domain/time/zoned-time';

const TZ = 'Africa/Lubumbashi';

describe('zoned-time', () => {
  it('Lubumbashi est à UTC+02:00, été comme hiver', () => {
    assert.equal(offsetMinutes(new Date('2026-01-15T12:00:00Z'), TZ), 120);
    assert.equal(offsetMinutes(new Date('2026-07-15T12:00:00Z'), TZ), 120);
  });

  it('toLocal donne date, minute du jour et jour ISO', () => {
    const l = toLocal(new Date('2026-11-09T05:45:30Z'), TZ);
    assert.equal(l.date, '2026-11-09');
    assert.equal(l.minuteOfDay, 465);
    assert.equal(l.second, 30);
    assert.equal(l.isoWeekday, 1);
  });

  it('minuit local : 22h00 UTC la veille', () => {
    const l = toLocal(new Date('2026-12-31T22:00:00Z'), TZ);
    assert.equal(l.date, '2027-01-01');
    assert.equal(l.hour, 0);
  });

  it('localToInstant est l\'inverse de toLocal', () => {
    assert.equal(localToInstant('2026-11-09', 465, TZ).toISOString(), '2026-11-09T05:45:00.000Z');
    assert.equal(localToInstant('2026-11-09', 1440, TZ).toISOString(), '2026-11-09T22:00:00.000Z');
  });

  it('localToInstant gère un fuseau à heure d\'été (Europe/Paris, 29 mars 2026)', () => {
    // 03h00 locale existe (après le saut de 02h00 à 03h00) et vaut 01h00 UTC.
    assert.equal(localToInstant('2026-03-29', 180, 'Europe/Paris').toISOString(), '2026-03-29T01:00:00.000Z');
  });

  it('refuse les dates inexistantes et les fuseaux inconnus', () => {
    assert.throws(() => parseLocalDate('2026-02-30'));
    assert.throws(() => parseLocalDate('09/11/2026'));
    assert.throws(() => assertValidTimeZone('Afrique/Lubumbashi'));
    assert.doesNotThrow(() => assertValidTimeZone(TZ));
  });

  it('formatMinuteOfDay', () => {
    assert.equal(formatMinuteOfDay(465), '07h45');
    assert.equal(formatMinuteOfDay(1050), '17h30');
  });
});
