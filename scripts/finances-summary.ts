/**
 * Récapitulatif d'une période (même calcul que la page), en lecture seule.
 *   pnpm tsx --env-file=.env scripts/finances-summary.ts 2026-10-01 2026-10-31 [arrivee|sejour|reservation]
 */
import { prisma } from "../src/lib/db";
import { eur } from "../src/lib/finances/filters";
import { loadReport } from "../src/lib/finances/load";
import type { Mode } from "../src/lib/finances/report";

async function main() {
  const [from, to, mode = "arrivee"] = process.argv.slice(2);
  const r = await loadReport({ periode: "dates", year: 0, month: 0, from, to, bien: "tous", mode: mode as Mode, annulations: "versement", vue: "biens" as const });
  const t = r.total;
  console.log(`Du ${from} au ${to} (${mode}) : ${t.stays} séjours, ${t.nights} nuits`);
  for (const [k, v] of [
    ["Chiffre d'affaires", t.revenue],
    ["  dont ménage", t.cleaning],
    ["Commissions", t.commission],
    ["Frais de paiement", t.paymentFees],
    ["Remboursements", t.refunds],
    ["Revenu net (bénéfice)", t.payout],
    ["Taxe de séjour", t.cityTax],
    ["TVA", t.vat],
    ["CA + taxes − remboursements (= totalPrice Hostaway)", t.revenue + t.cityTax + t.vat - t.refunds],
  ] as const)
    console.log(`  ${k.padEnd(52)} ${eur(v).padStart(14)}`);
}
main().finally(() => prisma.$disconnect());
