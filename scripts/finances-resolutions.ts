/**
 * Analyse des résolutions Airbnb (lecture seule) : quand airbnbPayoutSum les inclut-il ?
 *   pnpm tsx --env-file=.env scripts/finances-resolutions.ts
 */
import { prisma } from "../src/lib/db";

async function main() {
  const rows = await prisma.reservation.findMany({ where: { channel: "airbnbOfficial", status: { in: ["new", "modified"] } }, orderBy: { arrivalDate: "asc" } });
  const groups: Record<string, number> = {};
  for (const r of rows) {
    const f = (r.raw as { finance?: Record<string, number> | null }).finance ?? {};
    const res = r.raw as { reservation: Record<string, unknown> };
    const reso = (f.airbnbClosedResolutionsSum ?? 0) + (f.airbnbOpenResolutionsSum ?? 0);
    if (!reso) continue;
    const gross = (f.baseRate ?? 0) + (f.cleaningFeeValue ?? 0) + (f.priceForExtraPerson ?? 0) - (f.hostChannelFee ?? 0);
    const payout = f.airbnbPayoutSum ?? 0;
    const kind = Math.abs(payout - gross) < 0.02 ? "payout SANS résolution" : Math.abs(payout - (gross + reso)) < 0.02 ? "payout AVEC résolution" : "autre";
    const key = `${kind} | ${reso > 0 ? "résolution +" : "résolution −"} | ${f.airbnbOpenResolutionsSum ? "ouverte" : "fermée"} | ${res.reservation.paymentStatus}`;
    groups[key] = (groups[key] ?? 0) + 1;
    console.log(`${r.arrivalDate.toISOString().slice(0, 10)} #${r.id} réso=${reso.toFixed(2).padStart(9)} brut=${gross.toFixed(2).padStart(8)} payout=${payout.toFixed(2).padStart(8)} tp=${(r.totalPriceCents / 100).toFixed(2).padStart(8)} ${kind}`);
  }
  console.log(groups);
}
main().finally(() => prisma.$disconnect());
