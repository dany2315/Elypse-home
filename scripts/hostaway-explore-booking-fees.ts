/**
 * Détail financier EN DIRECT des réservations Booking d'une période (lecture seule) :
 * frais de paiement, TVA, commission, paiements enregistrés. Aucune donnée personnelle.
 *   pnpm tsx --env-file=.env scripts/hostaway-explore-booking-fees.ts 2026-11-01 2026-11-15
 */
import { prisma } from "../src/lib/db";
import { createHostawayClient } from "../src/lib/hostaway";
import { dbTokenStore } from "../src/lib/finances/sync";

async function main() {
  const [from, to] = process.argv.slice(2);
  const client = createHostawayClient({ store: dbTokenStore });
  const rows = await prisma.reservation.findMany({
    where: { channel: "bookingcom", status: { in: ["new", "modified"] }, arrivalDate: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } },
    include: { listing: { select: { internalName: true } } },
  });
  for (const r of rows) {
    const f = (await client.get<Record<string, unknown>>(`/financeStandardField/reservation/${r.id}`)).result ?? {};
    const charges = (await client.get<Record<string, unknown>[]>(`/guestPayments/charges`, { reservationId: r.id })).result ?? [];
    const paid = charges.filter((c) => c.status === "paid").reduce((a, c) => a + Number(c.amount ?? 0), 0);
    const nonZero = Object.fromEntries(Object.entries(f).filter(([k, v]) => typeof v === "number" && v !== 0 && !/Id$|^id$/.test(k)));
    console.log(`${r.listing.internalName} #${r.id} totalPrice=${(r.totalPriceCents / 100).toFixed(2)} payé=${paid.toFixed(2)} (${charges.length} paiement(s)) 1,4 %=${((r.totalPriceCents / 100) * 0.014).toFixed(2)}`);
    console.log("   finance en direct :", JSON.stringify(nonZero));
  }
}
main().finally(() => prisma.$disconnect());
