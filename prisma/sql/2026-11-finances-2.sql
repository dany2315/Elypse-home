-- AlterTable
ALTER TABLE "reservation" ADD COLUMN     "refundsCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vatCents" INTEGER NOT NULL DEFAULT 0;

