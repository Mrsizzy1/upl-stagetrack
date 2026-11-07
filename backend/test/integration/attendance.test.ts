/**
 * Tests d'intégration du pointage : API NestJS réelle, base PostgreSQL de test, horloge simulée.
 * Couvre les 12 cas obligatoires du cahier des charges (section 14), les accès simultanés,
 * la clôture des sessions et les corrections.
 *
 * La base de test est remise à zéro avant chaque exécution (npm run test:integration).
 */
import './test-env'; // doit rester le premier import
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { ClosureService } from '../../src/attendance/closure.service';
import { Clock, FixedClock } from '../../src/common/clock/clock';
import { encodeQrPayload, openToken } from '../../src/domain/qr/qr-token';
import { PrismaService } from '../../src/prisma/prisma.service';

const MONDAY = '2026-11-09';
const at = (time: string) => new Date(`${MONDAY}T${time}+02:00`);
const PASSWORD = 'Motdepasse2026';

describe('Pointage de bout en bout', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clock = new FixedClock(at('07:00:00'));
  const tokens: Record<string, string> = {};
  const qr: Record<string, string> = {};
  const studentIds: Record<string, string> = {};

  const api = () => request(app.getHttpServer());
  const scan = (payload: string, as = 'agent') =>
    api().post('/api/attendance/scan').set('Authorization', `Bearer ${tokens[as]}`).send({ qr: payload });

  before(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue(clock).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const key = app.get(ConfigService).getOrThrow<Buffer>('QR_TOKEN_ENCRYPTION_KEY');

    // Rôles, comptes, référentiel et horaires officiels : données de test uniquement.
    const roles = Object.fromEntries(
      await Promise.all(
        (['ADMIN', 'SUPERVISOR', 'SCAN_AGENT', 'STUDENT'] as const).map(async (code) => [
          code,
          (await prisma.role.upsert({ where: { code }, update: {}, create: { code, label: code } })).id,
        ]),
      ),
    );
    const hash = await argon2.hash(PASSWORD);
    for (const [username, role] of [['admin', 'ADMIN'], ['agent', 'SCAN_AGENT'], ['resp', 'SUPERVISOR']] as const) {
      await prisma.user.create({ data: { username, fullName: username, passwordHash: hash, roleId: roles[role], mustChangePassword: false } });
    }
    for (const sessionType of ['MORNING', 'EVENING'] as const) {
      await prisma.attendanceSchedule.create({
        data: {
          sessionType,
          opensAtMinute: sessionType === 'MORNING' ? 465 : 1020,
          closesAtMinute: sessionType === 'MORNING' ? 525 : 1050,
          activeWeekdays: [1, 2, 3, 4, 5],
          effectiveFrom: new Date(`${MONDAY}T00:00:00Z`),
        },
      });
    }
    const faculty = await prisma.faculty.create({ data: { code: 'TEST', name: 'Faculté de test' } });
    const department = await prisma.department.create({ data: { code: 'TD', name: 'Département de test', facultyId: faculty.id } });
    const promotion = await prisma.promotion.create({ data: { code: 'TP', label: 'Promotion de test', sortOrder: 1 } });

    for (const name of ['admin', 'agent', 'resp']) {
      const res = await api().post('/api/auth/login').send({ username: name, password: PASSWORD }).expect(200);
      tokens[name] = res.body.accessToken;
    }

    // Étudiants créés par l'API (le QR est émis automatiquement).
    for (const name of ['s1', 's2', 's3', 's4', 'suspendu', 'revoque', 'absent']) {
      const res = await api()
        .post('/api/students')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({
          matricule: `TEST-${name}`,
          lastName: name,
          middleName: 'Postnom',
          firstName: 'Prénom',
          facultyId: faculty.id,
          departmentId: department.id,
          promotionId: promotion.id,
          enrolledAt: '2025-10-01',
          internship: { startDate: '2026-11-02', endDate: '2026-12-18' },
        })
        .expect(201);
      studentIds[name] = res.body.id;
      const credential = await prisma.qRCodeCredential.findFirstOrThrow({ where: { studentId: res.body.id, status: 'ACTIVE' } });
      qr[name] = encodeQrPayload(openToken(credential.tokenSealed, key));
    }

    // Compte de connexion d'un étudiant.
    await api()
      .post(`/api/students/${studentIds.s1}/account`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ temporaryPassword: PASSWORD })
      .expect(201);
    await prisma.user.update({ where: { username: 'test-s1' }, data: { mustChangePassword: false } });
    tokens.student = (await api().post('/api/auth/login').send({ username: 'TEST-s1', password: PASSWORD }).expect(200)).body.accessToken;

    await api()
      .patch(`/api/students/${studentIds.suspendu}/status`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ status: 'SUSPENDED', reason: 'Test de suspension' })
      .expect(200);
    await api()
      .post(`/api/students/${studentIds.revoque}/qr/revoke`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ reason: 'Carte perdue (test)' })
      .expect(204);

    // Les étudiants sont créés à l'heure réelle ; la clôture n'attend que ceux enregistrés avant
    // la fermeture de la session. On antidate donc leur création par rapport au lundi simulé.
    await prisma.student.updateMany({ data: { createdAt: new Date('2026-10-01T00:00:00Z') } });
  });

  after(async () => {
    await app?.close();
  });

  it('07h44 : refusé (trop tôt)', async () => {
    clock.set(at('07:44:00'));
    const res = await scan(qr.s1).expect(200);
    assert.equal(res.body.result, 'TOO_EARLY');
    assert.equal(res.body.accepted, false);
  });

  it('07h45 : accepté', async () => {
    clock.set(at('07:45:00'));
    const res = await scan(qr.s1).expect(200);
    assert.equal(res.body.result, 'ACCEPTED');
    assert.equal(res.body.sessionType, 'MORNING');
    assert.equal(res.body.recordedAt, '2026-11-09T05:45:00.000Z');
    assert.equal(res.body.student.matricule, 'TEST-S1');
  });

  it('deux scans successifs : un seul pointage', async () => {
    clock.set(at('07:46:10'));
    const res = await scan(qr.s1).expect(200);
    assert.equal(res.body.result, 'ALREADY_RECORDED');
    assert.match(res.body.message, /07h45/);
    const rows = await prisma.attendance.count({ where: { studentId: studentIds.s1, sessionType: 'MORNING' } });
    assert.equal(rows, 1);
  });

  it('accès simultanés : 10 scans parallèles du même QR → 1 seul pointage', async () => {
    clock.set(at('08:00:00'));
    const results = await Promise.all(Array.from({ length: 10 }, () => scan(qr.s2)));
    const accepted = results.filter((r) => r.body.result === 'ACCEPTED').length;
    const duplicates = results.filter((r) => r.body.result === 'ALREADY_RECORDED').length;
    assert.equal(accepted, 1);
    assert.equal(duplicates, 9);
    assert.equal(await prisma.attendance.count({ where: { studentId: studentIds.s2, sessionType: 'MORNING' } }), 1);
  });

  it('08h45 : accepté', async () => {
    clock.set(at('08:45:00'));
    assert.equal((await scan(qr.s3).expect(200)).body.result, 'ACCEPTED');
  });

  it('après 08h45 : refusé', async () => {
    clock.set(at('08:46:00'));
    const res = await scan(qr.s4).expect(200);
    assert.equal(res.body.result, 'SESSION_CLOSED');
  });

  it('16h59 : refusé', async () => {
    clock.set(at('16:59:00'));
    const res = await scan(qr.s1).expect(200);
    assert.notEqual(res.body.result, 'ACCEPTED');
  });

  it('17h00 : accepté (session du soir)', async () => {
    clock.set(at('17:00:00'));
    const res = await scan(qr.s1).expect(200);
    assert.equal(res.body.result, 'ACCEPTED');
    assert.equal(res.body.sessionType, 'EVENING');
  });

  it('17h30 : accepté', async () => {
    clock.set(at('17:30:00'));
    assert.equal((await scan(qr.s2).expect(200)).body.result, 'ACCEPTED');
  });

  it('après 17h30 : refusé', async () => {
    clock.set(at('17:31:00'));
    assert.equal((await scan(qr.s3).expect(200)).body.result, 'SESSION_CLOSED');
  });

  it('QR Code révoqué : refusé', async () => {
    clock.set(at('17:10:00'));
    assert.equal((await scan(qr.revoque).expect(200)).body.result, 'REVOKED_QR');
  });

  it('étudiant suspendu : refusé', async () => {
    clock.set(at('17:10:00'));
    assert.equal((await scan(qr.suspendu).expect(200)).body.result, 'STUDENT_SUSPENDED');
  });

  it('QR étranger au système : refusé sans révéler d\'information', async () => {
    const res = await scan('https://exemple.com/MAT-2024-01').expect(200);
    assert.equal(res.body.result, 'INVALID_QR');
    assert.equal(res.body.student, null);
  });

  it('tentative de pointage avec un compte étudiant : refusée (403)', async () => {
    clock.set(at('17:05:00'));
    const res = await scan(qr.s4, 'student').expect(403);
    assert.equal(res.body.code, 'FORBIDDEN');
  });

  it('un étudiant ne peut ni lister ni corriger les présences', async () => {
    await api().get(`/api/attendance?date=${MONDAY}`).set('Authorization', `Bearer ${tokens.student}`).expect(403);
  });

  it('saisie manuelle : motif obligatoire, puis acceptée', async () => {
    clock.set(at('17:20:00'));
    await api().post('/api/attendance/manual').set('Authorization', `Bearer ${tokens.agent}`).send({ matricule: 'TEST-s4' }).expect(400);
    const res = await api()
      .post('/api/attendance/manual')
      .set('Authorization', `Bearer ${tokens.agent}`)
      .send({ matricule: 'test-s4', reason: 'Téléphone déchargé' })
      .expect(200);
    assert.equal(res.body.result, 'ACCEPTED');
    const row = await prisma.attendance.findFirstOrThrow({ where: { studentId: studentIds.s4, sessionType: 'EVENING' } });
    assert.equal(row.method, 'MANUAL');
  });

  it('chaque tentative est journalisée', async () => {
    // 13 scans unitaires + 10 scans parallèles ; les requêtes refusées par la garde (403) ou la validation (400)
    // n'atteignent pas le moteur de pointage.
    assert.equal(await prisma.scanAttempt.count(), 23);
    const revoked = await prisma.scanAttempt.count({ where: { result: 'REVOKED_QR' } });
    assert.equal(revoked, 1);
  });

  it('clôture : absents calculés, rejouable sans doublon', async () => {
    clock.set(at('17:32:00'));
    const closure = app.get(ClosureService);
    const first = await closure.closeDueSessions();
    assert.equal(first, 2);
    assert.equal(await closure.closeDueSessions(), 0);

    const morning = await prisma.attendanceSession.findFirstOrThrow({ where: { sessionType: 'MORNING' } });
    // Matin : s1, s2, s3 présents ; s4, revoque, absent absents ; suspendu non attendu.
    assert.equal(morning.presentCount, 3);
    assert.equal(morning.absentCount, 3);
    assert.equal(
      await prisma.attendance.count({ where: { studentId: studentIds.suspendu } }),
      0,
      'un étudiant suspendu ne doit pas être compté absent',
    );
    const evening = await prisma.attendanceSession.findFirstOrThrow({ where: { sessionType: 'EVENING' } });
    assert.equal(evening.presentCount, 3); // s1, s2, s4 (manuel)
    assert.equal(evening.absentCount, 3); // s3, revoque, absent
  });

  it("après la clôture, la journée est visible au tableau de bord", async () => {
    const res = await api().get(`/api/dashboard?date=${MONDAY}`).set('Authorization', `Bearer ${tokens.resp}`).expect(200);
    assert.equal(res.body.morning.present, 3);
    assert.equal(res.body.evening.absent, 3);
    assert.equal(res.body.rate, 50);
  });

  it('correction : refusée au responsable, exige un motif, journalisée', async () => {
    const row = await prisma.attendance.findFirstOrThrow({ where: { studentId: studentIds.absent, sessionType: 'MORNING' } });
    await api()
      .post(`/api/attendance/${row.id}/corrections`)
      .set('Authorization', `Bearer ${tokens.resp}`)
      .send({ newStatus: 'PRESENT', reason: 'Présent mais QR oublié, attesté par le responsable' })
      .expect(403);
    await api()
      .post(`/api/attendance/${row.id}/corrections`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ newStatus: 'PRESENT', reason: 'court' })
      .expect(400);
    const res = await api()
      .post(`/api/attendance/${row.id}/corrections`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ newStatus: 'PRESENT', reason: 'Présent mais QR oublié, attesté par le responsable' })
      .expect(201);
    assert.equal(res.body.status, 'PRESENT');
    assert.equal(res.body.isCorrected, true);
    assert.equal(await prisma.auditLog.count({ where: { action: 'ATTENDANCE_CORRECTED', entityId: row.id } }), 1);
  });

  it('rapport mensuel exportable en Excel et PDF', async () => {
    const q = `period=monthly&date=${MONDAY}&groupBy=student`;
    const json = await api().get(`/api/reports?${q}`).set('Authorization', `Bearer ${tokens.admin}`).expect(200);
    assert.equal(json.body.rows.length, 6);
    const xlsx = await api().get(`/api/reports/export.xlsx?${q}`).set('Authorization', `Bearer ${tokens.admin}`).buffer().expect(200);
    assert.equal(xlsx.headers['content-type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const pdf = await api().get(`/api/reports/export.pdf?${q}`).set('Authorization', `Bearer ${tokens.admin}`).buffer().expect(200);
    assert.equal(pdf.headers['content-type'], 'application/pdf');
  });

  it('route sans rôle déclaré ou sans jeton : refus', async () => {
    await api().get('/api/students').expect(401);
    await api().get('/api/users').set('Authorization', `Bearer ${tokens.agent}`).expect(403);
  });
});
