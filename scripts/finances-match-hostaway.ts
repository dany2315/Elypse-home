/**
 * Rapprochement bien par bien avec le rapport Hostaway « Activité de location » (lecture seule).
 * Affiche les composantes par bien et l'écart avec les chiffres Hostaway saisis ci-dessous.
 *   pnpm tsx --env-file=.env scripts/finances-match-hostaway.ts
 */
import { prisma } from "../src/lib/db";

// Rapport Hostaway : 01/11/2026 → 15/11/2026, par arrivée, 2 statuts (capture du 15/11/2026).
const FROM = "2026-11-01";
const TO = "2026-11-15";
const HOSTAWAY: Record<string, { profit: number; revenue: number }> = {
  "Le Vaneau": { profit: 1395.58, revenue: 1979.3 },
  "Le Bosquet": { profit: 2319.16, revenue: 3440.58 },
  "Le Amelot 62": { profit: 2154.94, revenue: 3057.49 },
  "Le Bartholdi": { profit: 1582.06, revenue: 2833.44 },
  "Le Toudic": { profit: 1401.22, revenue: 2513.62 },
  "Le Amelot 157": { profit: 1710.56, revenue: 2430.67 },
  "101 rue Nollet": { profit: 1629.01, revenue: 2538.86 },
  "La Sourdière": { profit: 2422.3, revenue: 3215.96 },
  "Le Miromesnil": { profit: 0, revenue: 3308.8 },
  "Saint martin": { profit: 2194.26, revenue: 3043.71 },
};

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

async function main() {
  const rows = await prisma.reservation.findMany({
    where: {
      status: { in: ["new", "modified"] },
      arrivalDate: { gte: new Date(`${FROM}T00:00:00Z`), lte: new Date(`${TO}T00:00:00Z`) },
    },
    include: { listing: { select: { internalName: true, name: true } } },
  });
  const by = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const name = r.listing.internalName || r.listing.name;
    const f = (r.raw as { finance?: Record<string, number> | null }).finance ?? {};
    const res = (r.raw as { reservation: Record<string, unknown> }).reservation;
    const c = by.get(name) ?? {};
    const add = (k: string, v: number) => (c[k] = (c[k] ?? 0) + v);
    add("n", 1);
    add("revenueHostaway", r.totalPriceCents / 100 + r.refundsCents / 100);
    add("ca", r.revenueCents / 100);
    add("net", r.payoutCents / 100);
    add("cityTax", r.cityTaxCents / 100);
    add("vat", r.vatCents / 100);
    add("refunds", r.refundsCents / 100);
    add("commission", r.commissionCents / 100);
    add("hostFee", n(f.hostChannelFee));
    add("guestFee", n(f.guestChannelFee));
    add("cleaning", r.cleaningFeeCents / 100);
    add("baseRate", n(f.baseRate));
    add("airbnbPayout", n(f.airbnbPayoutSum));
    add("airbnbExpectedPayout", n(res.airbnbExpectedPayoutAmount));
    add("channelCommissionAmount", n(res.channelCommissionAmount));
    add(r.channel === "bookingcom" ? "nBooking" : "nAirbnb", 1);
    by.set(name, c);
  }

  const fmt = (v: number) => v.toFixed(2).padStart(9);
  console.log("Bien             | Revenus HA | module   | Profit HA | net mod. | écart    | taxe séj | TVA   | comm.   | rembours | ménage | airbnbPayout | rés.");
  const tot: Record<string, number> = {};
  for (const [name, h] of Object.entries(HOSTAWAY)) {
    const c = by.get(name) ?? {};
    for (const [k, v] of Object.entries(c)) tot[k] = (tot[k] ?? 0) + v;
    console.log(
      `${name.padEnd(16)} |${fmt(h.revenue)} |${fmt(c.revenueHostaway ?? 0)} |${fmt(h.profit)} |${fmt(c.net ?? 0)} |${fmt((c.net ?? 0) - h.profit)} |${fmt(c.cityTax ?? 0)} |${fmt(c.vat ?? 0)} |${fmt(c.commission ?? 0)} |${fmt(c.refunds ?? 0)} |${fmt(c.cleaning ?? 0)} |${fmt(c.airbnbPayout ?? 0)}    | ${c.nAirbnb ?? 0} Airbnb, ${c.nBooking ?? 0} Booking`,
    );
  }
  const hp = Object.values(HOSTAWAY).reduce((a, h) => a + h.profit, 0);
  console.log(`TOTAL            |           |${fmt(tot.revenueHostaway)} |${fmt(hp)} |${fmt(tot.net)} |${fmt(tot.net - hp)} |${fmt(tot.cityTax)} |${fmt(tot.vat)} |${fmt(tot.commission)} |${fmt(tot.refunds)} |${fmt(tot.cleaning)} |${fmt(tot.airbnbPayout)}`);

  // Écart par bien rapporté à quelques grandeurs : cherche une formule commune.
  console.log("\nÉcart (net module − profit Hostaway) comparé à des composantes :");
  for (const [name, h] of Object.entries(HOSTAWAY)) {
    const c = by.get(name) ?? {};
    const gap = (c.net ?? 0) - h.profit;
    console.log(
      `${name.padEnd(16)} écart ${fmt(gap)} · taxe+TVA ${fmt((c.cityTax ?? 0) + (c.vat ?? 0))} · écart−taxes ${fmt(gap - (c.cityTax ?? 0) - (c.vat ?? 0))} · ratio écart/CA ${(gap / (c.ca || 1)).toFixed(4)} · ratio (écart−taxes)/CA ${((gap - (c.cityTax ?? 0) - (c.vat ?? 0)) / (c.ca || 1)).toFixed(4)}`,
    );
  }
}
main().finally(() => prisma.$disconnect());
