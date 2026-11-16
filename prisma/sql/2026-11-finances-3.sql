-- Finances : nom du voyageur (vue par réservation).
ALTER TABLE "reservation" ADD COLUMN IF NOT EXISTS "guestName" TEXT;
