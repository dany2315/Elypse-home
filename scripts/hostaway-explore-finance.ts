/**
 * Détail financier de quelques réservations (lecture seule, sans données personnelles) :
 * champ `reservationFees` et endpoint /financeStandardField/reservation/{id}.
 *
 *   pnpm tsx --env-file=.env scripts/hostaway-explore-finance.ts [AAAA-MM]
 */
import { createHostawayClient } from "../src/lib/hostaway";
import { fileTokenStore } from "./hostaway-token-file";

async function main() {
  const month = process.argv[2] ?? "2026-10";
  const [y, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const client = createHostawayClient({ store: fileTokenStore });
  const res = await client.listReservations({ arrivalStartDate: `${month}-01`, arrivalEndDate: end });

  const picks = new Map<string, typeof res>();
  for (const r of res) {
    const key = `${r.channelName}/${r.status}`;
    if ((picks.get(key)?.length ?? 0) < 2) picks.set(key, [...(picks.get(key) ?? []), r]);
  }
  for (const [key, list] of picks) {
    if (!/new|modified|cancelled|ownerStay/.test(key)) continue;
    for (const r of list) {
      console.log(`\n=== ${key} #${r.id} nuits=${r.nights} totalPrice=${r.totalPrice} taxAmount=${r.taxAmount} channelCommissionAmount=${r.channelCommissionAmount} cleaningFee=${r.cleaningFee} airbnbPayout=${r.airbnbExpectedPayoutAmount} airbnbHostFee=${r.airbnbListingHostFee} airbnbCleaning=${r.airbnbListingCleaningFee} airbnbTOT=${r.airbnbTransientOccupancyTaxPaidAmount} airbnbTotalPaid=${r.airbnbTotalPaidAmount}`);
      console.log("reservationFees :", JSON.stringify(r.reservationFees));
      try {
        const fsf = await client.get<Record<string, unknown>>(`/financeStandardField/reservation/${r.id}`);
        const nonNull = Object.fromEntries(Object.entries(fsf.result ?? {}).filter(([, v]) => v !== null && v !== 0 && typeof v !== "object"));
        console.log("financeStandardField (non nuls) :", JSON.stringify(nonNull));
        console.log("financeStandardField (clés) :", Object.keys(fsf.result ?? {}).join(","));
      } catch (e) {
        console.log("financeStandardField : ", e instanceof Error ? e.message : e);
      }
    }
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
