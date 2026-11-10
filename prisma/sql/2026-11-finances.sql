-- CreateTable
CREATE TABLE "bien" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "livretId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostaway_listing" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "internalName" TEXT NOT NULL DEFAULT '',
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "bienId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hostaway_listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation" (
    "id" INTEGER NOT NULL,
    "listingId" INTEGER NOT NULL,
    "channelId" INTEGER,
    "channel" TEXT NOT NULL,
    "channelReservationId" TEXT,
    "status" TEXT NOT NULL,
    "arrivalDate" DATE NOT NULL,
    "departureDate" DATE NOT NULL,
    "reservationDate" DATE,
    "nights" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "commissionCents" INTEGER NOT NULL DEFAULT 0,
    "paymentFeesCents" INTEGER NOT NULL DEFAULT 0,
    "payoutCents" INTEGER NOT NULL DEFAULT 0,
    "cityTaxCents" INTEGER NOT NULL DEFAULT 0,
    "cleaningFeeCents" INTEGER NOT NULL DEFAULT 0,
    "totalPriceCents" INTEGER NOT NULL DEFAULT 0,
    "raw" JSONB NOT NULL,
    "hostawayUpdatedOn" TEXT,
    "financeFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostaway_state" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "accessToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncMessage" TEXT,
    "lastSyncStats" JSONB,
    "lastFullSyncAt" TIMESTAMP(3),
    "syncLockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hostaway_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bien_livretId_idx" ON "bien"("livretId");

-- CreateIndex
CREATE INDEX "hostaway_listing_bienId_idx" ON "hostaway_listing"("bienId");

-- CreateIndex
CREATE INDEX "reservation_listingId_idx" ON "reservation"("listingId");

-- CreateIndex
CREATE INDEX "reservation_arrivalDate_idx" ON "reservation"("arrivalDate");

-- CreateIndex
CREATE INDEX "reservation_departureDate_idx" ON "reservation"("departureDate");

-- CreateIndex
CREATE INDEX "reservation_reservationDate_idx" ON "reservation"("reservationDate");

-- AddForeignKey
ALTER TABLE "bien" ADD CONSTRAINT "bien_livretId_fkey" FOREIGN KEY ("livretId") REFERENCES "livret"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostaway_listing" ADD CONSTRAINT "hostaway_listing_bienId_fkey" FOREIGN KEY ("bienId") REFERENCES "bien"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "hostaway_listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

