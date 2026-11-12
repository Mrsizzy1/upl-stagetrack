-- Extension de la plateforme UPL StageTrack
-- Nouveaux modules : Objets perdus et retrouvés, Supervision des laboratoires par QR Code,
-- Administration et Paramètres institutionnels.

-- 1. Extension de l'enum RoleCode
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'FACULTY_ADMIN';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'INTERNSHIP_MANAGER';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'IT_TECHNICIAN';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'INTERN';

-- 2. Nouveaux enums
CREATE TYPE "ItemType" AS ENUM ('LOST', 'FOUND');
CREATE TYPE "ItemCategory" AS ENUM ('ELECTRONICS', 'DOCUMENTS', 'BAGS', 'CLOTHING', 'KEYS', 'JEWELRY', 'BOOKS', 'OTHER');
CREATE TYPE "ItemStatus" AS ENUM ('PENDING', 'PUBLISHED', 'CLAIM_REQUESTED', 'APPROVED', 'RETURNED', 'REJECTED', 'CLOSED');
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TYPE "MachineStatus" AS ENUM ('FUNCTIONAL', 'TO_CHECK', 'DEFECTIVE', 'MAINTENANCE', 'OUT_OF_SERVICE');
CREATE TYPE "ComponentState" AS ENUM ('FUNCTIONAL', 'DEFECTIVE', 'MISSING', 'TO_CHECK', 'NOT_APPLICABLE');
CREATE TYPE "InterventionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "InterventionStatus" AS ENUM ('REPORTED', 'PENDING', 'IN_PROGRESS', 'RESOLVED', 'UNRESOLVED', 'CLOSED');

-- 3. Objets perdus et retrouvés
CREATE TABLE "ItemDeclaration" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "ItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "photoPath" TEXT,
    "eventDate" DATE NOT NULL,
    "location" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "status" "ItemStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdById" UUID,
    "approvedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemDeclaration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ItemDeclaration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ItemDeclaration_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ItemDeclaration_status_type_idx" ON "ItemDeclaration"("status", "type");
CREATE INDEX "ItemDeclaration_category_idx" ON "ItemDeclaration"("category");
CREATE INDEX "ItemDeclaration_eventDate_idx" ON "ItemDeclaration"("eventDate");

CREATE TABLE "ItemClaim" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "declarationId" UUID NOT NULL,
    "claimantName" TEXT NOT NULL,
    "claimantPhone" TEXT NOT NULL,
    "claimantEmail" TEXT,
    "proofDescription" TEXT NOT NULL,
    "proofPhotoPath" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" UUID,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemClaim_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ItemClaim_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "ItemDeclaration"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemClaim_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ItemClaim_declarationId_idx" ON "ItemClaim"("declarationId");
CREATE INDEX "ItemClaim_status_idx" ON "ItemClaim"("status");

CREATE TABLE "ItemReturn" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "declarationId" UUID NOT NULL,
    "claimId" UUID,
    "returnedToName" TEXT NOT NULL,
    "returnedToIdNumber" TEXT,
    "returnedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedById" UUID NOT NULL,
    "notes" TEXT,

    CONSTRAINT "ItemReturn_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ItemReturn_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "ItemDeclaration"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ItemReturn_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ItemClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ItemReturn_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ItemReturn_declarationId_idx" ON "ItemReturn"("declarationId");

-- 4. Laboratoires et Parc Informatique
CREATE TABLE "Laboratory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "managerId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Laboratory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Laboratory_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Laboratory_code_key" ON "Laboratory"("code");
CREATE INDEX "Laboratory_code_idx" ON "Laboratory"("code");
CREATE INDEX "Laboratory_isActive_idx" ON "Laboratory"("isActive");

CREATE TABLE "LaboratoryRow" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "laboratoryId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaboratoryRow_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LaboratoryRow_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "Laboratory"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LaboratoryRow_laboratoryId_code_key" ON "LaboratoryRow"("laboratoryId", "code");
CREATE INDEX "LaboratoryRow_laboratoryId_sortOrder_idx" ON "LaboratoryRow"("laboratoryId", "sortOrder");

CREATE TABLE "ComponentType" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComponentType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComponentType_code_key" ON "ComponentType"("code");
CREATE INDEX "ComponentType_sortOrder_idx" ON "ComponentType"("sortOrder");

CREATE TABLE "Machine" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "laboratoryId" UUID NOT NULL,
    "rowId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "positionInRow" INTEGER NOT NULL DEFAULT 1,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "acquisitionDate" DATE,
    "specifications" TEXT,
    "photoPath" TEXT,
    "publicToken" UUID NOT NULL DEFAULT gen_random_uuid(),
    "generalStatus" "MachineStatus" NOT NULL DEFAULT 'FUNCTIONAL',
    "lastControlAt" TIMESTAMPTZ(3),
    "lastControlById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Machine_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "Laboratory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Machine_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "LaboratoryRow"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Machine_lastControlById_fkey" FOREIGN KEY ("lastControlById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Machine_code_key" ON "Machine"("code");
CREATE UNIQUE INDEX "Machine_publicToken_key" ON "Machine"("publicToken");
CREATE INDEX "Machine_laboratoryId_rowId_idx" ON "Machine"("laboratoryId", "rowId");
CREATE INDEX "Machine_publicToken_idx" ON "Machine"("publicToken");
CREATE INDEX "Machine_generalStatus_idx" ON "Machine"("generalStatus");

CREATE TABLE "MachineComponent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "machineId" UUID NOT NULL,
    "componentTypeId" UUID NOT NULL,
    "state" "ComponentState" NOT NULL DEFAULT 'FUNCTIONAL',
    "notes" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineComponent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MachineComponent_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MachineComponent_componentTypeId_fkey" FOREIGN KEY ("componentTypeId") REFERENCES "ComponentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MachineComponent_machineId_componentTypeId_key" ON "MachineComponent"("machineId", "componentTypeId");
CREATE INDEX "MachineComponent_machineId_idx" ON "MachineComponent"("machineId");
CREATE INDEX "MachineComponent_state_idx" ON "MachineComponent"("state");

CREATE TABLE "MachineControl" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "machineId" UUID NOT NULL,
    "technicianId" UUID NOT NULL,
    "controlledAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generalStatus" "MachineStatus" NOT NULL,
    "observations" TEXT,
    "photoPath" TEXT,
    "ip" TEXT,

    CONSTRAINT "MachineControl_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MachineControl_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MachineControl_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "MachineControl_machineId_controlledAt_idx" ON "MachineControl"("machineId", "controlledAt");
CREATE INDEX "MachineControl_technicianId_idx" ON "MachineControl"("technicianId");

CREATE TABLE "MachineControlDetail" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "controlId" UUID NOT NULL,
    "componentName" TEXT NOT NULL,
    "previousState" "ComponentState" NOT NULL,
    "newState" "ComponentState" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "MachineControlDetail_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MachineControlDetail_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "MachineControl"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MachineControlDetail_controlId_idx" ON "MachineControlDetail"("controlId");

CREATE TABLE "TechnicalIntervention" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "machineId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "InterventionPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "InterventionStatus" NOT NULL DEFAULT 'REPORTED',
    "technicianId" UUID,
    "reportedById" UUID,
    "reportedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(3),
    "resolvedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "resolutionReport" TEXT,
    "replacedParts" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicalIntervention_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TechnicalIntervention_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TechnicalIntervention_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TechnicalIntervention_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "TechnicalIntervention_machineId_idx" ON "TechnicalIntervention"("machineId");
CREATE INDEX "TechnicalIntervention_status_idx" ON "TechnicalIntervention"("status");
CREATE INDEX "TechnicalIntervention_priority_idx" ON "TechnicalIntervention"("priority");
CREATE INDEX "TechnicalIntervention_technicianId_idx" ON "TechnicalIntervention"("technicianId");

CREATE TABLE "InstitutionSetting" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "institutionName" TEXT NOT NULL DEFAULT 'Université Protestante de Lubumbashi',
    "facultyName" TEXT NOT NULL DEFAULT 'Faculté des Sciences Informatiques',
    "acronym" TEXT NOT NULL DEFAULT 'UPL',
    "logoUrl" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "portalSubtitle" TEXT DEFAULT 'Portail numérique unifié des services universitaires',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionSetting_pkey" PRIMARY KEY ("id")
);

-- 5. Protection par déclencheur d'immuabilité (append-only) pour MachineControl
CREATE TRIGGER "MachineControl_append_only"
  BEFORE UPDATE OR DELETE ON "MachineControl"
  FOR EACH ROW EXECUTE FUNCTION stagetrack_forbid_log_change();

CREATE TRIGGER "MachineControl_no_truncate"
  BEFORE TRUNCATE ON "MachineControl"
  FOR EACH STATEMENT EXECUTE FUNCTION stagetrack_forbid_log_change();

