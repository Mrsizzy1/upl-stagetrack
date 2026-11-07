/**
 * Tests obligatoires du cahier des charges (section 14) sur les bornes horaires,
 * plus les changements de date et les limites de fuseau.
 * Exécution : npm run test:unit (aucune base de données nécessaire).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_WINDOWS,
  SessionWindow,
  evaluateScanTime,
  sessionBounds,
  validateWindows,
  describeRefusal,
} from '../../src/domain/attendance/schedule-rules';

const TZ = 'Africa/Lubumbashi';
// Le lundi 9 novembre 2026 ; Lubumbashi est en UTC+02:00.
const MONDAY = '2026-11-09';
const at = (date: string, time: string) => new Date(`${date}T${time}+02:00`);
const decide = (time: string, date = MONDAY, windows: readonly SessionWindow[] = INITIAL_WINDOWS) =>
  evaluateScanTime(at(date, time), TZ, windows);

describe('Session du matin (07h45 – 08h45)', () => {
  it('07h44 : refusé, trop tôt', () => {
    const d = decide('07:44:00');
    assert.equal(d.outcome, 'TOO_EARLY');
  });
  it('07h44:59 : refusé, trop tôt', () => {
    assert.equal(decide('07:44:59').outcome, 'TOO_EARLY');
  });
  it('07h45 : accepté', () => {
    const d = decide('07:45:00');
    assert.deepEqual(d, { outcome: 'OPEN', localDate: MONDAY, sessionType: 'MORNING', isLate: false });
  });
  it('08h45 : accepté', () => {
    const d = decide('08:45:00');
    assert.equal(d.outcome, 'OPEN');
    assert.equal(d.outcome === 'OPEN' && d.sessionType, 'MORNING');
  });
  it('08h45:59 : accepté (minute de fermeture incluse, décision D5)', () => {
    assert.equal(decide('08:45:59').outcome, 'OPEN');
  });
  it('08h46 : refusé, session fermée, soir annoncé', () => {
    const d = decide('08:46:00');
    assert.equal(d.outcome, 'SESSION_CLOSED');
    if (d.outcome === 'SESSION_CLOSED') {
      assert.equal(d.closedSessionType, 'MORNING');
      assert.equal(d.nextSessionType, 'EVENING');
      assert.equal(d.nextOpensAtMinute, 17 * 60);
    }
  });
});

describe('Session du soir (17h00 – 17h30)', () => {
  it('16h59 : refusé', () => {
    const d = decide('16:59:00');
    assert.notEqual(d.outcome, 'OPEN');
    assert.equal(d.outcome, 'SESSION_CLOSED');
  });
  it('16h59:59 : refusé', () => {
    assert.notEqual(decide('16:59:59').outcome, 'OPEN');
  });
  it('17h00 : accepté', () => {
    const d = decide('17:00:00');
    assert.deepEqual(d, { outcome: 'OPEN', localDate: MONDAY, sessionType: 'EVENING', isLate: false });
  });
  it('17h30 : accepté', () => {
    assert.equal(decide('17:30:00').outcome, 'OPEN');
  });
  it('17h31 : refusé, plus de session aujourd\'hui', () => {
    const d = decide('17:31:00');
    assert.equal(d.outcome, 'SESSION_CLOSED');
    if (d.outcome === 'SESSION_CLOSED') assert.equal(d.nextSessionType, null);
  });
  it('23h59:59 : refusé', () => {
    assert.equal(decide('23:59:59').outcome, 'SESSION_CLOSED');
  });
});

describe('Fuseau horaire et changement de date', () => {
  it('05h45 UTC correspond à 07h45 à Lubumbashi : accepté', () => {
    const d = evaluateScanTime(new Date('2026-11-09T05:45:00Z'), TZ, INITIAL_WINDOWS);
    assert.equal(d.outcome, 'OPEN');
  });
  it('05h44:59 UTC correspond à 07h44:59 : refusé', () => {
    const d = evaluateScanTime(new Date('2026-11-09T05:44:59.999Z'), TZ, INITIAL_WINDOWS);
    assert.equal(d.outcome, 'TOO_EARLY');
  });
  it('22h30 UTC le dimanche est déjà lundi 00h30 à Lubumbashi', () => {
    const d = evaluateScanTime(new Date('2026-11-08T22:30:00Z'), TZ, INITIAL_WINDOWS);
    assert.equal(d.localDate, MONDAY);
    assert.equal(d.outcome, 'TOO_EARLY');
  });
  it('21h59 UTC le lundi est encore lundi 23h59 à Lubumbashi', () => {
    const d = evaluateScanTime(new Date('2026-11-09T21:59:00Z'), TZ, INITIAL_WINDOWS);
    assert.equal(d.localDate, MONDAY);
  });
  it("le même instant n'est pas lu à l'heure du navigateur : un autre fuseau donne une autre décision", () => {
    // 07h45 à Lubumbashi = 05h45 à Londres en novembre ; si l'on prenait Europe/London, ce serait trop tôt.
    const instant = new Date('2026-11-09T05:45:00Z');
    assert.equal(evaluateScanTime(instant, TZ, INITIAL_WINDOWS).outcome, 'OPEN');
    assert.equal(evaluateScanTime(instant, 'Europe/London', INITIAL_WINDOWS).outcome, 'TOO_EARLY');
  });
});

describe('Jours sans session', () => {
  it('samedi : aucune session (hypothèse D8, jours lundi–vendredi)', () => {
    assert.equal(decide('08:00:00', '2026-11-07').outcome, 'NO_SESSION');
  });
  it('dimanche : aucune session', () => {
    assert.equal(decide('17:10:00', '2026-11-08').outcome, 'NO_SESSION');
  });
  it('samedi activé pour le matin seulement', () => {
    const windows: SessionWindow[] = [
      { ...INITIAL_WINDOWS[0], activeWeekdays: [1, 2, 3, 4, 5, 6] },
      INITIAL_WINDOWS[1],
    ];
    assert.equal(decide('08:00:00', '2026-11-07', windows).outcome, 'OPEN');
    assert.equal(decide('17:10:00', '2026-11-07', windows).outcome, 'SESSION_CLOSED');
  });
});

describe('Retards (décision D6)', () => {
  it('sans seuil configuré, 08h45 n\'est pas un retard', () => {
    const d = decide('08:45:00');
    assert.equal(d.outcome === 'OPEN' && d.isLate, false);
  });
  it('seuil à 08h00 : 08h00:59 à l\'heure, 08h01 en retard', () => {
    const windows: SessionWindow[] = [{ ...INITIAL_WINDOWS[0], lateAfterMinute: 8 * 60 }, INITIAL_WINDOWS[1]];
    const onTime = decide('08:00:59', MONDAY, windows);
    const late = decide('08:01:00', MONDAY, windows);
    assert.equal(onTime.outcome === 'OPEN' && onTime.isLate, false);
    assert.equal(late.outcome === 'OPEN' && late.isLate, true);
  });
});

describe('Bornes absolues stockées en base', () => {
  it('session du matin : 05h45Z inclus, 06h46Z exclu', () => {
    const b = sessionBounds(MONDAY, INITIAL_WINDOWS[0], TZ);
    assert.equal(b.opensAt.toISOString(), '2026-11-09T05:45:00.000Z');
    assert.equal(b.closesAt.toISOString(), '2026-11-09T06:46:00.000Z');
    assert.equal(b.lateFrom, null);
  });
  it('session du soir : 15h00Z inclus, 15h31Z exclu', () => {
    const b = sessionBounds(MONDAY, INITIAL_WINDOWS[1], TZ);
    assert.equal(b.opensAt.toISOString(), '2026-11-09T15:00:00.000Z');
    assert.equal(b.closesAt.toISOString(), '2026-11-09T15:31:00.000Z');
  });
});

describe('Validation des horaires saisis par l\'administrateur', () => {
  it('les horaires initiaux sont valides', () => {
    assert.deepEqual(validateWindows(INITIAL_WINDOWS), []);
  });
  it('refuse une fermeture avant l\'ouverture', () => {
    const errors = validateWindows([{ ...INITIAL_WINDOWS[0], opensAtMinute: 600, closesAtMinute: 500 }]);
    assert.ok(errors.length > 0);
  });
  it('refuse un chevauchement matin / soir', () => {
    const errors = validateWindows([INITIAL_WINDOWS[0], { ...INITIAL_WINDOWS[1], opensAtMinute: 8 * 60 + 30 }]);
    assert.ok(errors.some((e) => e.includes('chevauchent')));
  });
  it('refuse un seuil de retard hors de la fenêtre', () => {
    const errors = validateWindows([{ ...INITIAL_WINDOWS[0], lateAfterMinute: 9 * 60 }]);
    assert.ok(errors.length > 0);
  });
  it('refuse un jour invalide', () => {
    const errors = validateWindows([{ ...INITIAL_WINDOWS[0], activeWeekdays: [0, 8] }]);
    assert.equal(errors.length, 2);
  });
});

describe('Messages affichés à l\'agent', () => {
  it('trop tôt', () => {
    const d = decide('07:00:00');
    assert.ok(d.outcome === 'TOO_EARLY');
    if (d.outcome === 'TOO_EARLY') {
      assert.equal(describeRefusal(d), 'Pointage trop tôt : la session du matin ouvre à 07h45.');
    }
  });
  it('fermée, soir annoncé', () => {
    const d = decide('09:00:00');
    if (d.outcome === 'SESSION_CLOSED') {
      assert.equal(describeRefusal(d), 'Session du matin fermée. Prochaine session du soir à 17h00.');
    } else {
      assert.fail('décision inattendue');
    }
  });
});
