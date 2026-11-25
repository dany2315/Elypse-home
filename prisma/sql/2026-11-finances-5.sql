-- Finances : charges « par séjour » (ménage payé par l'hôte à chaque séjour).
-- AlterTable
ALTER TABLE "bien_charge" ADD COLUMN "per" TEXT NOT NULL DEFAULT 'mois';
