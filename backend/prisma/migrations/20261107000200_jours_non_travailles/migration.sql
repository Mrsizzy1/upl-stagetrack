-- AlterEnum
ALTER TYPE "ScanResult" ADD VALUE 'UNKNOWN_MATRICULE';

-- CreateTable
CREATE TABLE "NonWorkingDay" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NonWorkingDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NonWorkingDay_date_key" ON "NonWorkingDay"("date");

-- AddForeignKey
ALTER TABLE "NonWorkingDay" ADD CONSTRAINT "NonWorkingDay_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Contrainte métier (hors Prisma)
ALTER TABLE "NonWorkingDay" ADD CONSTRAINT "NonWorkingDay_label_not_blank" CHECK (length(btrim("label")) > 0);
