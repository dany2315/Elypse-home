/**
 * Frais de ménage : tarif configuré sur chaque listing Hostaway (lecture seule) et ménages
 * réellement facturés dans les réservations confirmées. Aucune donnée personnelle.
 *   pnpm tsx --env-file=.env scripts/finances-cleaning.ts
 */
import { prisma } from "../src/lib/db";
import { createHostawayClient } from "../src/lib/hostaway";
import { dbTokenStore } from "../src/lib/finances/sync";

async function main() {
  const client = createHostawayClient({ store: dbTokenStore });
  const listings = await client.listListings();
  console.log("Tarif de ménage configuré sur les listings Hostaway :");
  for (const l of listings) console.log(`  #${l.id} ${String(l.internalListingName || l.name).padEnd(18)} cleaningFee=${l.cleaningFee ?? "—"} airbnbListingCleaningFee? ${l.airbnbCleaningFee ?? "—"}`);

  const rows = await prisma.reservation.findMany({
    where: { status: { in: ["new", "modified"] } },
    select: { listingId: true, channel: true, arrivalDate: true, cleaningFeeCents: true },
  });
  const by = new Map<string, { n: number; withFee: number; amounts: Set<number> }>();
  for (const r of rows) {
    const k = `${r.listingId} ${r.channel}`;
    const e = by.get(k) ?? { n: 0, withFee: 0, amounts: new Set<number>() };
    e.n++;
    if (r.cleaningFeeCents > 0) {
      e.withFee++;
      e.amounts.add(r.cleaningFeeCents / 100);
    }
    by.set(k, e);
  }
  console.log("\nSéjours confirmés avec un ménage facturé (par listing et plateforme) :");
  for (const [k, e] of [...by].sort()) console.log(`  ${k.padEnd(26)} ${String(e.withFee).padStart(3)} / ${String(e.n).padStart(3)}  montants : ${[...e.amounts].join(", ") || "—"}`);
  const months = new Map<string, [number, number]>();
  for (const r of rows) {
    const m = r.arrivalDate.toISOString().slice(0, 7);
    const e = months.get(m) ?? [0, 0];
    e[1]++;
    if (r.cleaningFeeCents > 0) e[0]++;
    months.set(m, e);
  }
  console.log("\nPar mois d'arrivée (avec ménage / séjours) :", Object.fromEntries([...months].sort().map(([m, [a, b]]) => [m, `${a}/${b}`])));
}
main().finally(() => prisma.$disconnect());
