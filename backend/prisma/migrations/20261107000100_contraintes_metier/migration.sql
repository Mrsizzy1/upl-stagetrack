-- UPL StageTrack — contraintes métier que Prisma ne sait pas déclarer dans schema.prisma.
-- Prisma ne gère ni les CHECK, ni les contraintes d'exclusion, ni les déclencheurs :
-- il les laisse en place et ne les supprime pas lors des migrations suivantes.

-- Pour la contrainte d'exclusion sur les périodes de stage (extension « trusted » depuis PostgreSQL 13).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------- Étudiants
ALTER TABLE "Student"
  ADD CONSTRAINT "Student_matricule_not_blank" CHECK (length(btrim("matricule")) > 0),
  ADD CONSTRAINT "Student_names_not_blank" CHECK (
    length(btrim("lastName")) > 0 AND length(btrim("firstName")) > 0
  );

-- ---------------------------------------------------------------- Stages
ALTER TABLE "Internship"
  ADD CONSTRAINT "Internship_dates_order" CHECK ("endDate" >= "startDate"),
  -- Deux stages d'un même étudiant ne peuvent pas se chevaucher (bornes incluses).
  ADD CONSTRAINT "Internship_no_overlap" EXCLUDE USING gist (
    "studentId" WITH =,
    daterange("startDate", "endDate", '[]') WITH &&
  );

-- ---------------------------------------------------------------- QR Codes
ALTER TABLE "QRCodeCredential"
  ADD CONSTRAINT "QRCodeCredential_hash_format" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
  -- activeSlot vaut true pour le QR actif et NULL pour les autres :
  -- avec l'index unique (studentId, activeSlot), un étudiant n'a qu'un QR actif.
  ADD CONSTRAINT "QRCodeCredential_active_slot_consistent" CHECK (
    ("status" = 'ACTIVE' AND "activeSlot" IS TRUE)
    OR ("status" <> 'ACTIVE' AND "activeSlot" IS NULL)
  ),
  ADD CONSTRAINT "QRCodeCredential_revocation_complete" CHECK (
    "status" = 'ACTIVE' OR "revokedAt" IS NOT NULL
  );

-- ---------------------------------------------------------------- Horaires
ALTER TABLE "AttendanceSchedule"
  ADD CONSTRAINT "AttendanceSchedule_minutes_range" CHECK (
    "opensAtMinute" BETWEEN 0 AND 1439 AND "closesAtMinute" BETWEEN 0 AND 1439
  ),
  ADD CONSTRAINT "AttendanceSchedule_window_order" CHECK ("opensAtMinute" <= "closesAtMinute"),
  ADD CONSTRAINT "AttendanceSchedule_late_in_window" CHECK (
    "lateAfterMinute" IS NULL
    OR ("lateAfterMinute" >= "opensAtMinute" AND "lateAfterMinute" < "closesAtMinute")
  ),
  ADD CONSTRAINT "AttendanceSchedule_weekdays_valid" CHECK (
    "activeWeekdays" IS NOT NULL AND "activeWeekdays" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]
  );

-- ---------------------------------------------------------------- Sessions
ALTER TABLE "AttendanceSession"
  ADD CONSTRAINT "AttendanceSession_bounds_order" CHECK ("opensAt" < "closesAt"),
  ADD CONSTRAINT "AttendanceSession_late_in_bounds" CHECK (
    "lateFrom" IS NULL OR ("lateFrom" > "opensAt" AND "lateFrom" <= "closesAt")
  ),
  ADD CONSTRAINT "AttendanceSession_closed_has_date" CHECK (
    "state" = 'OPEN' OR "closedAt" IS NOT NULL
  );

-- ---------------------------------------------------------------- Pointages
ALTER TABLE "Attendance"
  -- Un pointage présent ou en retard porte toujours l'heure du serveur.
  ADD CONSTRAINT "Attendance_time_when_present" CHECK (
    "status" = 'ABSENT' OR "recordedAt" IS NOT NULL OR "isCorrected"
  ),
  -- Une absence posée par la clôture n'a pas d'heure de pointage.
  ADD CONSTRAINT "Attendance_absence_from_system" CHECK (
    "status" <> 'ABSENT' OR "method" = 'SYSTEM' OR "isCorrected"
  ),
  -- Une saisie manuelle du matricule exige un motif.
  ADD CONSTRAINT "Attendance_manual_reason" CHECK (
    "method" <> 'MANUAL' OR length(btrim(coalesce("manualReason", ''))) >= 5
  );

-- ---------------------------------------------------------------- Corrections
ALTER TABLE "AttendanceCorrection"
  ADD CONSTRAINT "AttendanceCorrection_reason_length" CHECK (length(btrim("reason")) >= 10),
  ADD CONSTRAINT "AttendanceCorrection_changes_status" CHECK ("previousStatus" <> "newStatus");

-- ---------------------------------------------------------------- Journaux en ajout seul
-- Un déclencheur refuse toute modification ou suppression, quel que soit le rôle de connexion.
CREATE OR REPLACE FUNCTION stagetrack_forbid_log_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La table % est en ajout seul : % interdit', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "AuditLog_append_only"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION stagetrack_forbid_log_change();

CREATE TRIGGER "AuditLog_no_truncate"
  BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION stagetrack_forbid_log_change();

CREATE TRIGGER "ScanAttempt_append_only"
  BEFORE UPDATE OR DELETE ON "ScanAttempt"
  FOR EACH ROW EXECUTE FUNCTION stagetrack_forbid_log_change();

CREATE TRIGGER "ScanAttempt_no_truncate"
  BEFORE TRUNCATE ON "ScanAttempt"
  FOR EACH STATEMENT EXECUTE FUNCTION stagetrack_forbid_log_change();

CREATE TRIGGER "AttendanceCorrection_append_only"
  BEFORE UPDATE OR DELETE ON "AttendanceCorrection"
  FOR EACH ROW EXECUTE FUNCTION stagetrack_forbid_log_change();
