-- Tests des contraintes de la base, à exécuter sur une base vide migrée :
--   psql "$DATABASE_URL_TEST" -v ON_ERROR_STOP=1 -f test/sql/contraintes.test.sql
-- Tout s'exécute dans une transaction annulée à la fin : la base reste vide.
-- Chaque cas « doit échouer » lève une erreur s'il réussit.

\pset tuples_only on
\pset format unaligned

BEGIN;

CREATE TEMP TABLE ids AS SELECT
  gen_random_uuid() AS role_admin, gen_random_uuid() AS admin,
  gen_random_uuid() AS fac, gen_random_uuid() AS dep, gen_random_uuid() AS promo,
  gen_random_uuid() AS stu, gen_random_uuid() AS sched, gen_random_uuid() AS sess;

INSERT INTO "Role"(id, code, label) SELECT role_admin, 'ADMIN', 'Administrateur' FROM ids;
INSERT INTO "User"(id, username, "passwordHash", "fullName", "roleId", "updatedAt")
  SELECT admin, 'admin', 'x', 'Admin', role_admin, now() FROM ids;
INSERT INTO "Faculty"(id, code, name) SELECT fac, 'F1', 'Faculté test' FROM ids;
INSERT INTO "Department"(id, "facultyId", code, name) SELECT dep, fac, 'D1', 'Département test' FROM ids;
INSERT INTO "Promotion"(id, code, label, "sortOrder") SELECT promo, 'P1', 'Promotion test', 1 FROM ids;
INSERT INTO "Student"(id, matricule, "lastName", "middleName", "firstName", "facultyId", "departmentId", "promotionId", "enrolledAt", "updatedAt")
  SELECT stu, 'TEST-001', 'Nom', 'Postnom', 'Prénom', fac, dep, promo, DATE '2026-09-01', now() FROM ids;
INSERT INTO "AttendanceSchedule"(id, "sessionType", "opensAtMinute", "closesAtMinute", "activeWeekdays", "effectiveFrom")
  SELECT sched, 'MORNING', 465, 525, ARRAY[1,2,3,4,5], DATE '2026-11-01' FROM ids;
INSERT INTO "AttendanceSession"(id, date, "sessionType", "scheduleId", "opensAt", "closesAt")
  SELECT sess, DATE '2026-11-09', 'MORNING', sched, TIMESTAMPTZ '2026-11-09 05:45Z', TIMESTAMPTZ '2026-11-09 06:46Z' FROM ids;

-- Outil : exécute une requête qui doit échouer.
CREATE FUNCTION pg_temp.must_fail(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'OK (refusé) : % — %', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION 'ÉCHEC : « % » aurait dû être refusé', label;
END $$;

-- 1. Un seul pointage par étudiant, date et session.
INSERT INTO "Attendance"(id, "studentId", "sessionId", date, "sessionType", status, "recordedAt", method, "updatedAt")
  SELECT gen_random_uuid(), stu, sess, DATE '2026-11-09', 'MORNING', 'PRESENT', TIMESTAMPTZ '2026-11-09 05:50Z', 'QR', now() FROM ids;
SELECT pg_temp.must_fail('second pointage même session', format(
  $q$INSERT INTO "Attendance"(id, "studentId", "sessionId", date, "sessionType", status, "recordedAt", method, "updatedAt")
     VALUES (gen_random_uuid(), %L, %L, DATE '2026-11-09', 'MORNING', 'PRESENT', now(), 'QR', now())$q$,
  (SELECT stu FROM ids), (SELECT sess FROM ids)));

-- 2. Présence sans heure serveur.
SELECT pg_temp.must_fail('présence sans heure', format(
  $q$INSERT INTO "Attendance"(id, "studentId", "sessionId", date, "sessionType", status, method, "updatedAt")
     VALUES (gen_random_uuid(), %L, %L, DATE '2026-11-10', 'MORNING', 'PRESENT', 'QR', now())$q$,
  (SELECT stu FROM ids), (SELECT sess FROM ids)));

-- 3. Saisie manuelle sans motif.
SELECT pg_temp.must_fail('saisie manuelle sans motif', format(
  $q$INSERT INTO "Attendance"(id, "studentId", "sessionId", date, "sessionType", status, "recordedAt", method, "updatedAt")
     VALUES (gen_random_uuid(), %L, %L, DATE '2026-11-11', 'MORNING', 'PRESENT', now(), 'MANUAL', now())$q$,
  (SELECT stu FROM ids), (SELECT sess FROM ids)));

-- 4. Un seul QR actif par étudiant ; plusieurs révoqués autorisés.
INSERT INTO "QRCodeCredential"(id, "studentId", "tokenHash", "tokenSealed", "issuedById")
  SELECT gen_random_uuid(), stu, repeat('a', 64), 'sealed', admin FROM ids;
SELECT pg_temp.must_fail('deuxième QR actif', format(
  $q$INSERT INTO "QRCodeCredential"(id, "studentId", "tokenHash", "tokenSealed", "issuedById")
     VALUES (gen_random_uuid(), %L, repeat('b', 64), 'sealed', %L)$q$,
  (SELECT stu FROM ids), (SELECT admin FROM ids)));
UPDATE "QRCodeCredential" SET status = 'REPLACED', "activeSlot" = NULL, "revokedAt" = now() WHERE "tokenHash" = repeat('a', 64);
INSERT INTO "QRCodeCredential"(id, "studentId", "tokenHash", "tokenSealed", "issuedById")
  SELECT gen_random_uuid(), stu, repeat('b', 64), 'sealed', admin FROM ids;
UPDATE "QRCodeCredential" SET status = 'REVOKED', "activeSlot" = NULL, "revokedAt" = now() WHERE "tokenHash" = repeat('b', 64);
INSERT INTO "QRCodeCredential"(id, "studentId", "tokenHash", "tokenSealed", "issuedById")
  SELECT gen_random_uuid(), stu, repeat('c', 64), 'sealed', admin FROM ids;
SELECT pg_temp.must_fail('QR révoqué resté dans le créneau actif',
  $q$UPDATE "QRCodeCredential" SET status = 'REVOKED', "revokedAt" = now() WHERE "tokenHash" = repeat('c', 64)$q$);
SELECT pg_temp.must_fail('empreinte mal formée', format(
  $q$INSERT INTO "QRCodeCredential"(id, "studentId", "tokenHash", "tokenSealed", "issuedById", status, "activeSlot", "revokedAt")
     VALUES (gen_random_uuid(), %L, 'MATRICULE-EN-CLAIR', 'x', %L, 'REVOKED', NULL, now())$q$,
  (SELECT stu FROM ids), (SELECT admin FROM ids)));

-- 5. Stages : ordre des dates et absence de chevauchement.
INSERT INTO "Internship"(id, "studentId", "startDate", "endDate", "updatedAt")
  SELECT gen_random_uuid(), stu, DATE '2026-11-02', DATE '2026-12-18', now() FROM ids;
SELECT pg_temp.must_fail('stage qui chevauche', format(
  $q$INSERT INTO "Internship"(id, "studentId", "startDate", "endDate", "updatedAt")
     VALUES (gen_random_uuid(), %L, DATE '2026-12-18', DATE '2027-01-30', now())$q$, (SELECT stu FROM ids)));
SELECT pg_temp.must_fail('stage fini avant de commencer', format(
  $q$INSERT INTO "Internship"(id, "studentId", "startDate", "endDate", "updatedAt")
     VALUES (gen_random_uuid(), %L, DATE '2027-03-10', DATE '2027-03-01', now())$q$, (SELECT stu FROM ids)));
INSERT INTO "Internship"(id, "studentId", "startDate", "endDate", "updatedAt")
  SELECT gen_random_uuid(), stu, DATE '2026-12-19', DATE '2027-01-30', now() FROM ids;

-- 6. Horaires incohérents.
SELECT pg_temp.must_fail('fermeture avant ouverture',
  $q$INSERT INTO "AttendanceSchedule"(id, "sessionType", "opensAtMinute", "closesAtMinute", "activeWeekdays", "effectiveFrom")
     VALUES (gen_random_uuid(), 'EVENING', 1050, 1020, ARRAY[1], DATE '2026-11-01')$q$);
SELECT pg_temp.must_fail('seuil de retard hors fenêtre',
  $q$INSERT INTO "AttendanceSchedule"(id, "sessionType", "opensAtMinute", "closesAtMinute", "lateAfterMinute", "activeWeekdays", "effectiveFrom")
     VALUES (gen_random_uuid(), 'EVENING', 1020, 1050, 1050, ARRAY[1], DATE '2026-11-01')$q$);
SELECT pg_temp.must_fail('jour 8',
  $q$INSERT INTO "AttendanceSchedule"(id, "sessionType", "opensAtMinute", "closesAtMinute", "activeWeekdays", "effectiveFrom")
     VALUES (gen_random_uuid(), 'EVENING', 1020, 1050, ARRAY[1, 8], DATE '2026-11-01')$q$);

-- 7. Corrections : motif d'au moins 10 caractères, statut réellement changé, ajout seul.
SELECT pg_temp.must_fail('correction sans motif', format(
  $q$INSERT INTO "AttendanceCorrection"(id, "attendanceId", "previousStatus", "newStatus", reason, "correctedById")
     SELECT gen_random_uuid(), id, 'PRESENT', 'ABSENT', 'court', %L FROM "Attendance" LIMIT 1$q$, (SELECT admin FROM ids)));
INSERT INTO "AttendanceCorrection"(id, "attendanceId", "previousStatus", "newStatus", reason, "correctedById")
  SELECT gen_random_uuid(), a.id, 'PRESENT', 'ABSENT', 'Pointage fait par un tiers, constaté par le responsable', i.admin
  FROM "Attendance" a, ids i LIMIT 1;
SELECT pg_temp.must_fail('modifier une correction', $q$UPDATE "AttendanceCorrection" SET reason = 'motif réécrit après coup'$q$);

-- 8. Journaux en ajout seul.
INSERT INTO "AuditLog"(id, action, "entityType") VALUES (gen_random_uuid(), 'TEST', 'Test');
INSERT INTO "ScanAttempt"(id, "scannedAt", method, result) VALUES (gen_random_uuid(), now(), 'QR', 'INVALID_QR');
SELECT pg_temp.must_fail('modifier l''audit', $q$UPDATE "AuditLog" SET action = 'EFFACE'$q$);
SELECT pg_temp.must_fail('supprimer l''audit', $q$DELETE FROM "AuditLog"$q$);
SELECT pg_temp.must_fail('vider l''audit', $q$TRUNCATE "AuditLog"$q$);
SELECT pg_temp.must_fail('supprimer un scan', $q$DELETE FROM "ScanAttempt"$q$);

-- 9. Clôture : insertion des absents sans doublon, rejouable.
INSERT INTO "Student"(id, matricule, "lastName", "middleName", "firstName", "facultyId", "departmentId", "promotionId", "enrolledAt", "updatedAt")
  SELECT gen_random_uuid(), 'TEST-002', 'Absent', 'Postnom', 'Prénom', fac, dep, promo, DATE '2026-09-01', now() FROM ids;
INSERT INTO "Attendance"(id, "studentId", "sessionId", date, "sessionType", status, method, "updatedAt")
  SELECT gen_random_uuid(), s.id, i.sess, DATE '2026-11-09', 'MORNING', 'ABSENT', 'SYSTEM', now()
  FROM "Student" s, ids i ON CONFLICT ("studentId", date, "sessionType") DO NOTHING;
INSERT INTO "Attendance"(id, "studentId", "sessionId", date, "sessionType", status, method, "updatedAt")
  SELECT gen_random_uuid(), s.id, i.sess, DATE '2026-11-09', 'MORNING', 'ABSENT', 'SYSTEM', now()
  FROM "Student" s, ids i ON CONFLICT ("studentId", date, "sessionType") DO NOTHING;
DO $$
DECLARE presents int; absents int;
BEGIN
  SELECT count(*) FILTER (WHERE status = 'PRESENT'), count(*) FILTER (WHERE status = 'ABSENT')
    INTO presents, absents FROM "Attendance" WHERE date = DATE '2026-11-09';
  IF presents <> 1 OR absents <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC clôture : % présent(s), % absent(s), attendu 1 et 1', presents, absents;
  END IF;
  RAISE NOTICE 'OK : clôture rejouée deux fois, 1 présent conservé, 1 absent créé';
END $$;

ROLLBACK;
\echo 'Tous les tests de contraintes sont passés.'
