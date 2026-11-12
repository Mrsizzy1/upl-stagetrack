-- Keep historical controls and interventions when inventory machines are removed.
DROP TRIGGER "MachineControl_append_only" ON "MachineControl";

ALTER TABLE "MachineControl" ADD COLUMN "machineCode" TEXT;
UPDATE "MachineControl" AS control
SET "machineCode" = machine."code"
FROM "Machine" AS machine
WHERE control."machineId" = machine."id";
ALTER TABLE "MachineControl" ALTER COLUMN "machineCode" SET NOT NULL;
ALTER TABLE "MachineControl" ALTER COLUMN "machineId" DROP NOT NULL;
ALTER TABLE "MachineControl" DROP CONSTRAINT "MachineControl_machineId_fkey";
ALTER TABLE "MachineControl"
  ADD CONSTRAINT "MachineControl_machineId_fkey"
  FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TechnicalIntervention" ADD COLUMN "machineCode" TEXT;
UPDATE "TechnicalIntervention" AS intervention
SET "machineCode" = machine."code"
FROM "Machine" AS machine
WHERE intervention."machineId" = machine."id";
ALTER TABLE "TechnicalIntervention" ALTER COLUMN "machineCode" SET NOT NULL;
ALTER TABLE "TechnicalIntervention" ALTER COLUMN "machineId" DROP NOT NULL;
ALTER TABLE "TechnicalIntervention" DROP CONSTRAINT "TechnicalIntervention_machineId_fkey";
ALTER TABLE "TechnicalIntervention"
  ADD CONSTRAINT "TechnicalIntervention_machineId_fkey"
  FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Machine deletion may detach its immutable control record, but cannot alter any
-- recorded control data. The control itself remains append-only.
CREATE OR REPLACE FUNCTION stagetrack_forbid_log_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'MachineControl' AND TG_OP = 'UPDATE'
     AND OLD."machineId" IS NOT NULL AND NEW."machineId" IS NULL
     AND (to_jsonb(NEW) - 'machineId') = (to_jsonb(OLD) - 'machineId') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'La table % est en ajout seul : % interdit', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "MachineControl_append_only"
  BEFORE UPDATE OR DELETE ON "MachineControl"
  FOR EACH ROW EXECUTE FUNCTION stagetrack_forbid_log_change();

-- Remove contact placeholders that were previously seeded as if they were real.
ALTER TABLE "InstitutionSetting" ALTER COLUMN "facultyName" SET DEFAULT '';
UPDATE "InstitutionSetting"
SET "facultyName" = ''
WHERE "facultyName" = 'Faculté des Sciences Informatiques'
  AND ("contactEmail" = 'contact@upl-univ.ac'
    OR "contactPhone" = '+243 000 000 000'
    OR "address" = 'Lubumbashi, RDC');
UPDATE "InstitutionSetting" SET "contactEmail" = NULL WHERE "contactEmail" = 'contact@upl-univ.ac';
UPDATE "InstitutionSetting" SET "contactPhone" = NULL WHERE "contactPhone" = '+243 000 000 000';
UPDATE "InstitutionSetting" SET "address" = NULL WHERE "address" = 'Lubumbashi, RDC';

-- The former seed inserted these unapproved weekday windows. Preserve rows that
-- back historical sessions; application queries ignore those unapproved schedules.
ALTER TABLE "AttendanceSchedule"
  ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE "AttendanceSchedule" AS schedule
SET "approved" = FALSE
WHERE schedule."createdById" IS NULL
  AND (
    (schedule."sessionType" = 'MORNING' AND schedule."opensAtMinute" = 465 AND schedule."closesAtMinute" = 525
      AND schedule."lateAfterMinute" IS NULL AND schedule."activeWeekdays" = ARRAY[1, 2, 3, 4, 5])
    OR
    (schedule."sessionType" = 'EVENING' AND schedule."opensAtMinute" = 1020 AND schedule."closesAtMinute" = 1050
      AND schedule."lateAfterMinute" IS NULL AND schedule."activeWeekdays" = ARRAY[1, 2, 3, 4, 5])
  );

DELETE FROM "AttendanceSchedule" AS schedule
WHERE schedule."createdById" IS NULL
  AND schedule."approved" = FALSE
  AND (
    (schedule."sessionType" = 'MORNING' AND schedule."opensAtMinute" = 465 AND schedule."closesAtMinute" = 525
      AND schedule."lateAfterMinute" IS NULL AND schedule."activeWeekdays" = ARRAY[1, 2, 3, 4, 5])
    OR
    (schedule."sessionType" = 'EVENING' AND schedule."opensAtMinute" = 1020 AND schedule."closesAtMinute" = 1050
      AND schedule."lateAfterMinute" IS NULL AND schedule."activeWeekdays" = ARRAY[1, 2, 3, 4, 5])
  )
  AND NOT EXISTS (
    SELECT 1 FROM "AttendanceSession" AS session WHERE session."scheduleId" = schedule."id"
  );
