/**
 * Vérification indépendante d'un mois (arrivées) : relit Hostaway EN DIRECT (lecture seule),
 * compare réservation par réservation avec la base, et calcule les définitions possibles
 * de chaque colonne (pour rapprocher les chiffres du rapport Hostaway). Aucune donnée personnelle.
 *
 *   pnpm tsx --env-file=.env scripts/finances-verify-live.ts 2026-10
 */
import { prisma } from "../src/lib/db";
import { eur } from "../src/lib/finances/filters";
import { mapFinance } from "../src/lib/finances/mapping";
import { createHostawayClient } from "../src/lib/hostaway";
import { dbTokenStore } from "../src/lib/finances/sync";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const c = (v: number) => Math.round(v * 100);

async function main() {
  const month = process.argv[2] ?? "2026-10";
  const [y, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const client = createHostawayClient({ store: dbTokenStore });

  const live = await client.listReservations({ arrivalStartDate: `${month}-01`, arrivalEndDate: end });
  const db = new Map(
    (
      await prisma.reservation.findMany({
        where: { arrivalDate: { gte: new Date(`${month}-01T00:00:00Z`), lte: new Date(`${end}T00:00:00Z`) } },
      })
    ).map((r) => [r.id, r]),
  );
  console.log(`Hostaway en direct : ${live.length} réservations arrivant en ${month} · base : ${db.size}`);

  const missing = live.filter((r) => !db.has(r.id)).length;
  const extra = [...db.keys()].filter((id) => !live.some((r) => r.id === id)).length;
  const statusDiff = live.filter((r) => db.has(r.id) && db.get(r.id)!.status !== r.status).length;
  console.log(`Absentes de la base : ${missing} · en base mais plus dans Hostaway : ${extra} · statut différent : ${statusDiff}`);

  // Détail financier en direct pour les séjours confirmés et les annulations avec montant.
  const stays = live.filter((r) => ["new", "modified"].includes(String(r.status)) || (r.status === "cancelled" && n(r.totalPrice) !== 0));
  const fin = new Map<number, Record<string, unknown>>();
  for (const r of stays) fin.set(r.id, (await client.get<Record<string, unknown>>(`/financeStandardField/reservation/${r.id}`)).result ?? {});

  let mismatches = 0;
  const S: Record<string, number> = {};
  const add = (k: string, v: number) => (S[k] = (S[k] ?? 0) + v);
  for (const r of stays) {
    const f = fin.get(r.id)!;
    const mapped = mapFinance(r, f);
    const row = db.get(r.id);
    if (
      row &&
      (row.revenueCents !== mapped.revenueCents ||
        row.commissionCents !== mapped.commissionCents ||
        row.payoutCents !== mapped.payoutCents ||
        row.cityTaxCents !== mapped.cityTaxCents ||
        row.cleaningFeeCents !== mapped.cleaningFeeCents)
    ) {
      mismatches++;
      console.log(`  ≠ #${r.id} ${r.channelName} ${r.status} : base versement ${eur(row.payoutCents)} / direct ${eur(mapped.payoutCents)}`);
    }
    const confirmed = r.status !== "cancelled";
    const k = confirmed ? "conf" : "annul";
    add(`${k}.n`, 1);
    add(`${k}.nuits`, n(r.nights));
    add(`${k}.totalPrice`, c(n(r.totalPrice)));
    add(`${k}.baseRate`, c(n(f.baseRate)));
    add(`${k}.cleaningFeeValue`, c(n(f.cleaningFeeValue)));
    add(`${k}.hostChannelFee`, c(n(f.hostChannelFee)));
    add(`${k}.guestChannelFee`, c(n(f.guestChannelFee)));
    add(`${k}.taxeSejour`, mapped.cityTaxCents);
    add(`${k}.vat`, c(n(f.vat)));
    add(`${k}.resolutions`, c(n(f.airbnbClosedResolutionsSum) + n(f.airbnbOpenResolutionsSum)));
    add(`${k}.airbnbPayoutSum`, c(n(f.airbnbPayoutSum)));
    add(`${k}.revenus`, mapped.revenueCents);
    add(`${k}.commissions`, mapped.commissionCents);
    add(`${k}.versement`, mapped.payoutCents);
    // Versement « plateforme » : payout Airbnb réel, sinon notre calcul.
    add(`${k}.versementPlateforme`, String(r.channelName).startsWith("airbnb") ? c(n(f.airbnbPayoutSum)) : mapped.payoutCents);
  }
  console.log(`Écarts base ↔ Hostaway en direct (montants) : ${mismatches}`);

  for (const k of ["conf", "annul"]) {
    if (!S[`${k}.n`]) continue;
    console.log(`\n== ${k === "conf" ? "Séjours confirmés (new + modified)" : "Annulations avec montant"} : ${S[`${k}.n`]} · ${S[`${k}.nuits`]} nuits`);
    const show = (label: string, key: string) => console.log(`  ${label.padEnd(58)} ${eur(S[`${k}.${key}`] ?? 0).padStart(14)}`);
    show("totalPrice Hostaway (payé par le voyageur, taxes comprises)", "totalPrice");
    show("baseRate (prix des nuits)", "baseRate");
    show("cleaningFeeValue (ménage)", "cleaningFeeValue");
    show("hostChannelFee (commission hôte)", "hostChannelFee");
    show("guestChannelFee (frais de service voyageur Airbnb)", "guestChannelFee");
    show("taxe de séjour", "taxeSejour");
    show("TVA Booking (vat)", "vat");
    show("résolutions Airbnb", "resolutions");
    show("airbnbPayoutSum (versement Airbnb)", "airbnbPayoutSum");
    console.log("  — Affiché dans le module —");
    show("Revenus de location (totalPrice − taxe de séjour)", "revenus");
    show("Commissions", "commissions");
    show("Versement total", "versement");
    show("Versement si on prend le payout Airbnb réel", "versementPlateforme");
  }
}
main().finally(() => prisma.$disconnect());
