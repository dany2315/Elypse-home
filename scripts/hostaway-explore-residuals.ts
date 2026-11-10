/**
 * Écarts totalPrice vs composantes (lecture seule, depuis le cache des détails financiers).
 *   pnpm tsx --env-file=.env scripts/hostaway-explore-residuals.ts [AAAA-MM]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHostawayClient } from "../src/lib/hostaway";
import { fileTokenStore } from "./hostaway-token-file";

const CACHE = join(process.cwd(), "node_modules", ".cache", "elypse", "fsf");

async function main() {
  const month = process.argv[2] ?? "2026-10";
  const [y, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const client = createHostawayClient({ store: fileTokenStore });
  const res = await client.listReservations({ arrivalStartDate: `${month}-01`, arrivalEndDate: end });
  for (const r of res) {
    let f: Record<string, number>;
    try {
      f = JSON.parse(readFileSync(join(CACHE, `${r.id}.json`), "utf8"));
    } catch {
      continue;
    }
    const n = (k: string) => (typeof f[k] === "number" ? f[k] : 0);
    const tp = Number(r.totalPrice ?? 0);
    const parts = n("baseRate") + n("cleaningFeeValue") + n("vat") + n("salesTax") + n("cityTax") + n("guestChannelFee");
    const reso = n("airbnbClosedResolutionsSum") + n("airbnbOpenResolutionsSum");
    const resid = tp - parts;
    if (Math.abs(resid) > 0.02 || r.status === "cancelled")
      console.log(`${String(r.channelName).padEnd(15)} ${String(r.status).padEnd(10)} tp=${tp.toFixed(2).padStart(8)} parts=${parts.toFixed(2).padStart(8)} écart=${resid.toFixed(2).padStart(8)} réso=${reso.toFixed(2).padStart(8)} payout=${n("airbnbPayoutSum")} cancPayout=${n("cancellationPayout")} hostFee=${n("hostChannelFee")} guestFee=${n("guestChannelFee")} paymentStatus=${r.paymentStatus} isPaid=${r.isPaid}`);
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
