/**
 * Comparaison d'un mois avec le rapport Hostaway « Activité de location » (arrivées du mois).
 * Lecture seule (base du .env). Aucune donnée personnelle affichée.
 *
 *   pnpm tsx --env-file=.env scripts/finances-compare-month.ts 2026-10
 */
import { prisma } from "../src/lib/db";
import { eur } from "../src/lib/finances/filters";
import { loadReport } from "../src/lib/finances/load";

async function main() {
  const [y, m] = (process.argv[2] ?? "2026-10").split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));

  const byStatus = await prisma.reservation.groupBy({
    by: ["status", "channel"],
    where: { arrivalDate: { gte: start, lt: end } },
    _count: true,
    _sum: { totalPriceCents: true, revenueCents: true, payoutCents: true },
  });
  const all = byStatus.reduce((a, s) => a + s._count, 0);
  console.log(`Réservations arrivant en ${m}/${y} (tous statuts, comme Hostaway) : ${all}`);
  for (const s of byStatus.sort((a, b) => b._count - a._count))
    console.log(`  ${s.status.padEnd(20)} ${s.channel.padEnd(16)} ${String(s._count).padStart(4)}  totalPrice=${eur(s._sum.totalPriceCents ?? 0)}`);

  const resolutions = await prisma.reservation.findMany({
    where: { arrivalDate: { gte: start, lt: end }, status: { in: ["new", "modified"] } },
    select: { raw: true },
  });
  const reso = resolutions.reduce((a, r) => {
    const f = (r.raw as { finance?: Record<string, number> | null }).finance ?? {};
    return a + (f.airbnbClosedResolutionsSum ?? 0) + (f.airbnbOpenResolutionsSum ?? 0);
  }, 0);
  const payoutAirbnb = resolutions.reduce((a, r) => a + ((r.raw as { finance?: Record<string, number> | null }).finance?.airbnbPayoutSum ?? 0), 0);

  for (const annulations of ["versement", "toutes", "aucune"] as const) {
    const r = await loadReport({ periode: "mois", year: y, month: m, bien: "tous", mode: "arrivee", annulations, occ: true });
    const t = r.total;
    console.log(
      `\nArrivées du mois, annulations=${annulations} : ${t.stays} séjours, ${t.nights} nuits, revenus ${eur(t.revenue)}, commissions ${eur(t.commission)}, frais ${eur(t.paymentFees)}, versement ${eur(t.payout)}, taxe de séjour ${eur(t.cityTax)}, ménage ${eur(t.cleaning)} (doublons ignorés : ${r.duplicates})`,
    );
    if (annulations === "versement") {
      for (const row of r.rows) console.log(`  ${row.name.padEnd(18)} ${String(row.totals.stays).padStart(3)} séj. ${String(row.totals.nights).padStart(4)} n.  versement ${eur(row.totals.payout)}`);
      for (const c of r.byChannel) console.log(`  [${c.channel}] ${c.totals.stays} séj., revenus ${eur(c.totals.revenue)}, versement ${eur(c.totals.payout)}`);
    }
  }
  console.log(`\nRésolutions Airbnb (séjours confirmés du mois) : ${reso.toFixed(2)} € · somme airbnbPayoutSum : ${payoutAirbnb.toFixed(2)} €`);
}
main().finally(() => prisma.$disconnect());
