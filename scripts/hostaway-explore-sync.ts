/**
 * Dimensionnement de la synchro (lecture seule) : filtre departureStartDate, volumes,
 * fréquence de mise à jour (updatedOn), statuts.
 *   pnpm tsx --env-file=.env scripts/hostaway-explore-sync.ts
 */
import { createHostawayClient } from "../src/lib/hostaway";
import { fileTokenStore } from "./hostaway-token-file";

async function main() {
  const client = createHostawayClient({ store: fileTokenStore });
  const t0 = Date.now();
  const all = await client.listReservations({ departureStartDate: "2025-01-01" });
  console.log(`departureStartDate>=2025-01-01 : ${all.length} réservations en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const minDep = all.reduce((a, r) => (String(r.departureDate) < a ? String(r.departureDate) : a), "9999");
  const maxArr = all.reduce((a, r) => (String(r.arrivalDate) > a ? String(r.arrivalDate) : a), "0000");
  console.log("départ min :", minDep, "arrivée max :", maxArr);
  const total = await client.get<unknown[]>("/reservations", { limit: 1 });
  console.log("Total réservations du compte (count) :", total.count);
  const byYear: Record<string, number> = {};
  const statuses: Record<string, number> = {};
  const channels: Record<string, number> = {};
  const updatedDays: Record<string, number> = {};
  for (const r of all) {
    const y = String(r.arrivalDate).slice(0, 7);
    byYear[y] = (byYear[y] ?? 0) + 1;
    statuses[String(r.status)] = (statuses[String(r.status)] ?? 0) + 1;
    channels[`${r.channelName}#${r.channelId}`] = (channels[`${r.channelName}#${r.channelId}`] ?? 0) + 1;
    const u = String(r.updatedOn).slice(0, 10);
    updatedDays[u] = (updatedDays[u] ?? 0) + 1;
  }
  console.log("Par mois d'arrivée :", byYear);
  console.log("Statuts :", statuses);
  console.log("Canaux :", channels);
  console.log("updatedOn (10 derniers jours) :", Object.fromEntries(Object.entries(updatedDays).sort().slice(-10)));
  const listings = new Set(all.map((r) => r.listingMapId));
  console.log("Listings distincts dans les réservations :", listings.size);
  const dup = new Map<string, number>();
  for (const r of all) {
    const k = `${r.channelId}:${r.channelReservationId ?? r.reservationId ?? ""}`;
    if (!r.channelReservationId && !r.reservationId) continue;
    dup.set(k, (dup.get(k) ?? 0) + 1);
  }
  console.log("Références canal en double :", [...dup.values()].filter((n) => n > 1).length);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
