/**
 * Exploration de l'API Hostaway (lecture seule) pour établir le mapping financier.
 * N'affiche AUCUNE donnée personnelle : seulement les noms de champs, les montants,
 * les dates, statuts et canaux.
 *
 *   pnpm tsx --env-file=.env scripts/hostaway-explore.ts [AAAA-MM]
 */
import { createHostawayClient, type HostawayReservation } from "../src/lib/hostaway";
import { fileTokenStore } from "./hostaway-token-file";

const PERSONAL = /guest|email|phone|address|zip|city|country|doorCode|name$|Name$|picture|note|comment|message|hostNote|ip/i;
const KEEP_STR = new Set(["channelName", "status", "currency", "arrivalDate", "departureDate", "reservationDate", "insertedOn", "updatedOn", "paymentStatus", "source", "cancellationDate"]);

function safeFields(r: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === "number" || typeof v === "boolean" || v === null) {
      if (!/phone|zip/i.test(k)) out[k] = v;
    } else if (typeof v === "string" && (KEEP_STR.has(k) || (!PERSONAL.test(k) && v.length < 25 && /^[\d.:\- TZ+]*$/.test(v)))) {
      out[k] = v;
    }
  }
  return out;
}

async function main() {
  const month = process.argv[2] ?? "2026-10";
  const client = createHostawayClient({ store: fileTokenStore });

  const listings = await client.listListings();
  console.log(`Listings : ${listings.length}`);
  console.log("Champs listing :", Object.keys(listings[0] ?? {}).sort().join(", "));

  const [y, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const res = await client.listReservations({ arrivalStartDate: `${month}-01`, arrivalEndDate: end, includeResources: 1 });
  console.log(`\nRéservations arrivée ${month} : ${res.length}`);
  console.log("Champs réservation :", Object.keys(res[0] ?? {}).sort().join(", "));

  const byChannel = new Map<string, HostawayReservation[]>();
  for (const r of res) {
    const key = `${r.channelName} (#${r.channelId})`;
    byChannel.set(key, [...(byChannel.get(key) ?? []), r]);
  }
  const byStatus = new Map<string, number>();
  for (const r of res) byStatus.set(String(r.status), (byStatus.get(String(r.status)) ?? 0) + 1);
  console.log("Statuts :", Object.fromEntries(byStatus));
  console.log("Canaux :", Object.fromEntries([...byChannel].map(([k, v]) => [k, v.length])));

  for (const [ch, list] of byChannel) {
    for (const r of list.slice(0, 2)) {
      console.log(`\n=== ${ch} — réservation ${r.id}`);
      console.log(JSON.stringify(safeFields(r)));
      const ff = (r as Record<string, unknown>).financeField;
      if (Array.isArray(ff)) {
        console.log("financeField :", JSON.stringify(ff.map((f: Record<string, unknown>) => ({ name: f.name, alias: f.alias, type: f.type, value: f.value, total: f.total, isIncludedInTotalPrice: f.isIncludedInTotalPrice, isDeleted: f.isDeleted }))));
      }
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
