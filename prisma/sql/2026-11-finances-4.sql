-- Finances : exclusion d'un bien des rapports et charges fixes saisies à la main (versions datées).
-- AlterTable
ALTER TABLE "bien" ADD COLUMN     "excludedFromReports" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "bien_charge" (
    "id" TEXT NOT NULL,
    "bienId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'autre',
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bien_charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bien_charge_version" (
    "id" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "amountCents" INTEGER NOT NULL,
    "vatRateBp" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bien_charge_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bien_charge_bienId_idx" ON "bien_charge"("bienId");

-- CreateIndex
CREATE INDEX "bien_charge_version_chargeId_idx" ON "bien_charge_version"("chargeId");

-- AddForeignKey
ALTER TABLE "bien_charge" ADD CONSTRAINT "bien_charge_bienId_fkey" FOREIGN KEY ("bienId") REFERENCES "bien"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bien_charge_version" ADD CONSTRAINT "bien_charge_version_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "bien_charge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

