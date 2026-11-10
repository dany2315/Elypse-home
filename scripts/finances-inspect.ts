/**
 * Contrôle des données Finances en base (lecture seule, sans données personnelles).
 *   pnpm tsx --env-file=.env scripts/finances-inspect.ts
 */
import { prisma } from "../src/lib/db";

async function main() {
  const listings = await prisma.hostawayListing.findMany({
    orderBy: { id: "asc" },
    include: { bien: { select: { name: true } }, _count: { select: { reservations: true } } },
  });
  for (const l of listings)
    console.log(`#${l.id} ${l.internalName || l.name} | ${l.channels.join("+")} | actif=${l.active} | bien=${l.bien?.name} | ${l._count.reservations} rés.`);

  const rows = await prisma.reservation.findMany({ select: { raw: true, channel: true, status: true, cleaningFeeCents: true, paymentFeesCents: true } });
  const keys = new Map<string, number>();
  for (const r of rows) {
    const fin = (r.raw as { finance?: Record<string, number> | null }).finance ?? {};
    for (const k of Object.keys(fin)) keys.set(`${r.channel}.${k}`, (keys.get(`${r.channel}.${k}`) ?? 0) + 1);
  }
  console.log("\nChamps financiers non nuls (par canal) :");
  for (const [k, n] of [...keys].sort()) console.log(`  ${k}: ${n}`);
  // Cohérence Airbnb : versement calculé vs airbnbPayoutSum (Hostaway).
  const airbnb = await prisma.reservation.findMany({
    where: { channel: "airbnbOfficial", status: { in: ["new", "modified"] } },
    select: { id: true, payoutCents: true, revenueCents: true, totalPriceCents: true, raw: true },
  });
  const gaps: Record<string, { n: number; sum: number }> = {};
  for (const r of airbnb) {
    const fin = (r.raw as { finance?: Record<string, number> | null }).finance ?? {};
    const expected = Math.round((fin.airbnbPayoutSum ?? 0) * 100);
    const gap = r.payoutCents - expected;
    const why = Math.abs(gap) < 2 ? "égal" : fin.airbnbClosedResolutionsSum || fin.airbnbOpenResolutionsSum ? "résolution" : fin.guestChannelFee ? "guestChannelFee" : "autre";
    gaps[why] ??= { n: 0, sum: 0 };
    gaps[why].n++;
    gaps[why].sum += gap / 100;
    if (why === "guestChannelFee" || why === "autre")
      console.log(`  #${r.id} écart=${(gap / 100).toFixed(2)} guestChannelFee=${fin.guestChannelFee ?? 0} résolutions=${fin.airbnbClosedResolutionsSum ?? 0} priceForExtraPerson=${fin.priceForExtraPerson ?? 0}`);
  }
  console.log("\nVersement calculé − airbnbPayoutSum :", gaps);

  console.log(
    `\nMénage > 0 : ${rows.filter((r) => r.cleaningFeeCents > 0).length} · Frais de paiement > 0 : ${rows.filter((r) => r.paymentFeesCents > 0).length}`,
  );
}
main().finally(() => prisma.$disconnect());
