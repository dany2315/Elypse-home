/**
 * Agrégat des champs financiers Hostaway sur un mois d'arrivées (lecture seule) :
 * pour chaque canal, nombre de réservations où chaque champ est non nul et somme.
 * Les détails /financeStandardField sont mis en cache dans node_modules/.cache/elypse/fsf
 * (montants uniquement, aucune donnée personnelle).
 *
 *   pnpm tsx --env-file=.env scripts/hostaway-explore-aggregate.ts [AAAA-MM]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHostawayClient } from "../src/lib/hostaway";
import { fileTokenStore } from "./hostaway-token-file";

const CACHE = join(process.cwd(), "node_modules", ".cache", "elypse", "fsf");
mkdirSync(CACHE, { recursive: true });

const RES_FIELDS = ["totalPrice", "taxAmount", "channelCommissionAmount", "hostawayCommissionAmount", "cleaningFee", "remainingBalance", "airbnbExpectedPayoutAmount", "airbnbListingBasePrice", "airbnbListingHostFee", "airbnbListingCleaningFee", "airbnbTransientOccupancyTaxPaidAmount", "airbnbOccupancyTaxAmountPaidToHost", "airbnbTotalPaidAmount", "airbnbListingCancellationPayout", "airbnbListingCancellationHostFee"];

async function main() {
  const month = process.argv[2] ?? "2026-10";
  const [y, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const client = createHostawayClient({ store: fileTokenStore });
  const res = await client.listReservations({ arrivalStartDate: `${month}-01`, arrivalEndDate: end });

  const t0 = Date.now();
  let fetched = 0;
  const stats = new Map<string, Map<string, { n: number; sum: number }>>();
  const add = (ch: string, k: string, v: unknown) => {
    if (typeof v !== "number" || v === 0) return;
    const s = stats.get(ch) ?? new Map();
    stats.set(ch, s);
    const e = s.get(k) ?? { n: 0, sum: 0 };
    e.n++;
    e.sum += v;
    s.set(k, e);
  };
  const identity: Record<string, { ok: number; ko: number; examples: string[] }> = {};
  const counts: Record<string, number> = {};

  for (const r of res) {
    const ch = `${r.channelName}/${r.status}`;
    counts[ch] = (counts[ch] ?? 0) + 1;
    const file = join(CACHE, `${r.id}.json`);
    let f: Record<string, unknown>;
    try {
      f = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      f = (await client.get<Record<string, unknown>>(`/financeStandardField/reservation/${r.id}`)).result;
      writeFileSync(file, JSON.stringify(f));
      fetched++;
    }
    for (const k of RES_FIELDS) add(ch, `r.${k}`, r[k]);
    for (const [k, v] of Object.entries(f)) if (!/Id$|^id$/.test(k)) add(ch, `f.${k}`, v);

    // totalPrice = somme des champs financiers (hors commissions) ?
    const num = (k: string) => (typeof f[k] === "number" ? (f[k] as number) : 0);
    const sumParts = ["baseRate", "cleaningFeeValue", "vat", "salesTax", "cityTax", "otherTaxes", "otherFees", "guestChannelFee", "petFee", "additionalCleaningFee", "checkinFee", "earlyCheckinFee", "lateCheckoutFee", "extraBedsFee", "priceForExtraPerson", "couponDiscount", "weeklyDiscount", "monthlyDiscount", "lastMinuteDiscount", "otherSpecialDiscount", "transientOccupancyTax", "tourismFee", "bookingFee", "serviceFee"].reduce((a, k) => a + num(k), 0);
    const tp = typeof r.totalPrice === "number" ? r.totalPrice : 0;
    const key = String(r.channelName);
    identity[key] ??= { ok: 0, ko: 0, examples: [] };
    if (Math.abs(sumParts - tp) < 0.02) identity[key].ok++;
    else {
      identity[key].ko++;
      if (identity[key].examples.length < 6) identity[key].examples.push(`#${r.id} ${r.status} tp=${tp} somme=${sumParts.toFixed(2)}`);
    }
  }
  console.log(`${res.length} réservations, ${fetched} détails téléchargés en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log("Comptes :", counts);
  for (const [ch, s] of [...stats].sort()) {
    console.log(`\n## ${ch}`);
    for (const [k, e] of [...s].sort()) console.log(`  ${k.padEnd(42)} n=${String(e.n).padStart(3)} somme=${e.sum.toFixed(2)}`);
  }
  console.log("\ntotalPrice = somme des composantes :", JSON.stringify(identity, null, 1));
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
