/**
 * Détail financier par réservation (montants uniquement, aucune donnée personnelle), lecture seule.
 *   pnpm tsx --env-file=.env scripts/finances-reservation-detail.ts 2026-11-01 2026-11-15 "Le Toudic,Le Bosquet"
 */
import { prisma } from "../src/lib/db";

async function main() {
  const [from, to, names] = process.argv.slice(2);
  const wanted = names ? names.split(",") : null;
  const rows = await prisma.reservation.findMany({
    where: { status: { in: ["new", "modified"] }, arrivalDate: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } },
    include: { listing: { select: { internalName: true, name: true } } },
    orderBy: [{ listingId: "asc" }, { arrivalDate: "asc" }],
  });
  for (const r of rows) {
    const name = r.listing.internalName || r.listing.name;
    if (wanted && !wanted.includes(name)) continue;
    const raw = r.raw as { reservation: Record<string, unknown>; finance: Record<string, number> | null };
    const res = raw.reservation;
    const pick = Object.fromEntries(
      Object.entries(res).filter(([k, v]) => typeof v === "number" && v !== 0 && /price|fee|tax|payout|amount|commission|paid|balance|cleaning|cancellation/i.test(k)),
    );
    console.log(`\n${name} #${r.id} ${r.channel} ${r.status} ${r.arrivalDate.toISOString().slice(0, 10)} ${r.nights} n. — net module ${(r.payoutCents / 100).toFixed(2)}`);
    console.log("  réservation :", JSON.stringify(pick));
    console.log("  finance     :", JSON.stringify(raw.finance));
  }
}
main().finally(() => prisma.$disconnect());
