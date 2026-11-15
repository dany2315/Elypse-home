/**
 * Exploration (lecture seule) : où Hostaway stocke-t-il le coût du ménage (payé par l'hôte) ?
 * N'affiche que des noms de champs et des montants, aucune donnée personnelle.
 *   pnpm tsx --env-file=.env scripts/hostaway-explore-cleaning-cost.ts
 */
import { prisma } from "../src/lib/db";
import { createHostawayClient } from "../src/lib/hostaway";
import { dbTokenStore } from "../src/lib/finances/sync";

const interesting = /clean|m[eé]nage|cost|expense|fee|task/i;
const safe = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([k, v]) => interesting.test(k) && (typeof v === "number" || typeof v === "boolean" || v === null || (typeof v === "string" && v.length < 40) || Array.isArray(v))));

async function main() {
  const client = createHostawayClient({ store: dbTokenStore, maxAttempts: 2 });
  const listings = await prisma.hostawayListing.findMany({ select: { id: true, internalName: true } });

  // 1. Champs de la réservation et du détail financier contenant « clean ».
  const r = await prisma.reservation.findFirst({ where: { status: "new" }, orderBy: { arrivalDate: "desc" }, select: { raw: true } });
  const raw = r?.raw as { reservation?: Record<string, unknown>; finance?: Record<string, unknown> };
  console.log("réservation, champs clean :", Object.keys(raw.reservation ?? {}).filter((k) => /clean/i.test(k)).join(", "));
  console.log("finance, champs clean/cost :", Object.keys(raw.finance ?? {}).filter((k) => /clean|cost|expense/i.test(k)).join(", "));

  // 2. Listing complet : champs ménage / coût.
  for (const l of listings.slice(0, 2)) {
    const res = await client.get<Record<string, unknown>>(`/listings/${l.id}`);
    console.log(`\nlisting ${l.internalName} :`, JSON.stringify(safe(res.result as Record<string, unknown>)));
  }

  // 3. Endpoints candidats.
  const l0 = listings[0].id;
  for (const [path, params] of [
    [`/listingFeeSettings/${l0}`, {}],
    ["/expenses", { limit: 50 }],
    ["/tasks", { limit: 50 }],
    ["/autoTasks", { limit: 50 }],
    ["/financeField", { limit: 50 }],
    ["/financeCalculatedField", { limit: 50 }],
    ["/ownerStatements", { limit: 5 }],
    ["/accounting/expenses", { limit: 5 }],
  ] as [string, Record<string, number>][]) {
    try {
      const res = await client.get<unknown>(path, params);
      const list = Array.isArray(res.result) ? (res.result as Record<string, unknown>[]) : res.result ? [res.result as Record<string, unknown>] : [];
      console.log(`\n${path} : ${list.length} élément(s) (count=${res.count ?? "?"})`);
      if (list[0]) console.log("  champs :", Object.keys(list[0]).sort().join(", "));
      for (const e of list.slice(0, 8)) console.log("  ", JSON.stringify(safe(e)).slice(0, 400));
    } catch (err) {
      console.log(`\n${path} : ${err instanceof Error ? err.message.slice(0, 150) : err}`);
    }
  }
}
main().finally(() => prisma.$disconnect());
