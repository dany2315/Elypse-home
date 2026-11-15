/**
 * Recherche (lecture seule) du « Total payé » Hostaway d'une réservation Booking.
 * Affiche uniquement les champs numériques et statuts, aucune donnée personnelle.
 *   pnpm tsx --env-file=.env scripts/hostaway-explore-paid.ts 66063901
 */
import { prisma } from "../src/lib/db";
import { createHostawayClient } from "../src/lib/hostaway";
import { dbTokenStore } from "../src/lib/finances/sync";

const SAFE = (o: unknown) =>
  JSON.stringify(o, (k, v) => (k && typeof v === "string" && !/status|type|date|currency|method|channel/i.test(k) ? undefined : v)).slice(0, 1500);

async function main() {
  const id = process.argv[2];
  const client = createHostawayClient({ store: dbTokenStore, maxAttempts: 2 });
  const tries: [string, Record<string, string | number>][] = [
    [`/reservations/${id}`, { includeResources: 1 }],
    [`/guestPayments/charges`, { reservationId: id }],
    [`/financeTransactions`, { reservationId: id }],
    [`/reservations/${id}/payments`, {}],
    [`/reservations/${id}/charges`, {}],
  ];
  for (const [path, params] of tries) {
    try {
      const res = await client.get<unknown>(path, params);
      const r = res.result as Record<string, unknown> | unknown[];
      if (Array.isArray(r)) console.log(`${path} : ${r.length} élément(s)`, SAFE(r.slice(0, 5)));
      else {
        const nums = Object.fromEntries(Object.entries(r ?? {}).filter(([k, v]) => (typeof v === "number" && v !== 0) || /paid|payment/i.test(k)));
        console.log(`${path} :`, SAFE(nums));
      }
    } catch (e) {
      console.log(`${path} : ${e instanceof Error ? e.message : e}`);
    }
  }
}
main().finally(() => prisma.$disconnect());
