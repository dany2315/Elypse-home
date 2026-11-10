/**
 * Retrouve quelle définition donne un montant du rapport Hostaway (lecture seule, base du .env).
 * Teste plusieurs champs × statuts × dates de rattachement sur une période, affiche les plus proches.
 *
 *   pnpm tsx --env-file=.env scripts/finances-find-figure.ts 2026-11-01 2026-11-10 22093.01
 */
import { prisma } from "../src/lib/db";
import { eur } from "../src/lib/finances/filters";

type Raw = { reservation: Record<string, unknown>; finance: Record<string, number> | null };
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const c = (v: number) => Math.round(v * 100);

async function main() {
  const [from, to, target] = process.argv.slice(2);
  const goal = c(Number(target));
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(Date.parse(`${to}T00:00:00Z`) + 86_400_000);
  const all = await prisma.reservation.findMany({
    where: { OR: [{ arrivalDate: { gte: new Date(start.getTime() - 400 * 86_400_000) } }] },
  });

  const STATUS: Record<string, (s: string) => boolean> = {
    "confirmées": (s) => s === "new" || s === "modified",
    "confirmées + annulées": (s) => ["new", "modified", "cancelled"].includes(s),
    "tous statuts": () => true,
  };
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  const DATES: Record<string, (r: (typeof all)[number]) => boolean> = {
    "arrivée dans la période": (r) => iso(r.arrivalDate) >= from && iso(r.arrivalDate) <= to,
    "départ dans la période": (r) => iso(r.departureDate) >= from && iso(r.departureDate) <= to,
    "réservée dans la période": (r) => iso(r.reservationDate) >= from && iso(r.reservationDate) <= to,
    "séjour chevauchant la période": (r) => r.arrivalDate < end && r.departureDate > start,
  };
  const FIELDS: Record<string, (r: (typeof all)[number], raw: Raw) => number> = {
    "totalPrice": (r) => r.totalPriceCents,
    "totalPrice − taxe de séjour (module)": (r) => r.revenueCents,
    "totalPrice sans déduire les résolutions": (r, x) => r.totalPriceCents - c(n(x.finance?.airbnbClosedResolutionsSum) + n(x.finance?.airbnbOpenResolutionsSum)),
    "revenus module sans déduire les résolutions": (r, x) => r.revenueCents - c(n(x.finance?.airbnbClosedResolutionsSum) + n(x.finance?.airbnbOpenResolutionsSum)),
    "baseRate": (_, x) => c(n(x.finance?.baseRate)),
    "baseRate + ménage": (_, x) => c(n(x.finance?.baseRate) + n(x.finance?.cleaningFeeValue)),
    "baseRate + ménage + TVA": (_, x) => c(n(x.finance?.baseRate) + n(x.finance?.cleaningFeeValue) + n(x.finance?.vat)),
    "baseRate + ménage + frais voyageur": (_, x) => c(n(x.finance?.baseRate) + n(x.finance?.cleaningFeeValue) + n(x.finance?.guestChannelFee)),
    "versement module": (r) => r.payoutCents,
    "versement (payout Airbnb réel)": (r, x) => (r.channel.startsWith("airbnb") ? c(n(x.finance?.airbnbPayoutSum)) : r.payoutCents),
    "versement sans déduire les résolutions": (r, x) => r.payoutCents - c(n(x.finance?.airbnbClosedResolutionsSum) + n(x.finance?.airbnbOpenResolutionsSum)),
    "commissions module": (r) => r.commissionCents,
    "taxe de séjour": (r) => r.cityTaxCents,
  };

  const results: { label: string; value: number; count: number }[] = [];
  for (const [sl, sf] of Object.entries(STATUS))
    for (const [dl, df] of Object.entries(DATES)) {
      const set = all.filter((r) => sf(r.status) && df(r));
      for (const [fl, ff] of Object.entries(FIELDS)) {
        const value = set.reduce((a, r) => a + ff(r, r.raw as Raw), 0);
        results.push({ label: `${fl} · ${sl} · ${dl}`, value, count: set.length });
      }
    }
  results.sort((a, b) => Math.abs(a.value - goal) - Math.abs(b.value - goal));
  console.log(`Cible ${eur(goal)} — période du ${from} au ${to}\n`);
  for (const r of results.slice(0, 15))
    console.log(`${(r.value === goal ? "= " : "  ") + eur(r.value).padStart(13)}  (écart ${eur(r.value - goal).padStart(12)}, ${String(r.count).padStart(3)} rés.)  ${r.label}`);
}
main().finally(() => prisma.$disconnect());
