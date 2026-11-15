/**
 * Contrôle d'un bien à plusieurs annonces (lecture seule) : regroupement, réservations par annonce
 * en base et en direct dans Hostaway, doublons. Aucune donnée personnelle.
 *   pnpm tsx --env-file=.env scripts/finances-check-bien.ts "Le Miromesnil"
 */
import { prisma } from "../src/lib/db";
import { createHostawayClient } from "../src/lib/hostaway";
import { dbTokenStore } from "../src/lib/finances/sync";

async function main() {
  const name = process.argv[2] ?? "Le Miromesnil";
  const bien = await prisma.bien.findFirst({ where: { name }, include: { listings: true } });
  if (!bien) throw new Error(`Bien « ${name} » introuvable`);
  console.log(`Bien « ${bien.name} » : ${bien.listings.length} annonce(s)`);
  const client = createHostawayClient({ store: dbTokenStore });
  for (const l of bien.listings) {
    const inDb = await prisma.reservation.groupBy({ by: ["status", "channel"], where: { listingId: l.id }, _count: true });
    const live = await client.listReservations({ listingId: l.id });
    const liveCount: Record<string, number> = {};
    for (const r of live) liveCount[`${r.status}/${r.channelName}`] = (liveCount[`${r.status}/${r.channelName}`] ?? 0) + 1;
    console.log(`\n  #${l.id} ${l.internalName || l.name} · plateformes ${l.channels.join("+") || "—"}`);
    console.log("    en base   :", Object.fromEntries(inDb.map((g) => [`${g.status}/${g.channel}`, g._count])));
    console.log("    Hostaway  :", liveCount);
  }
  const refs = await prisma.reservation.groupBy({
    by: ["channel", "channelReservationId"],
    where: { listingId: { in: bien.listings.map((l) => l.id) }, channelReservationId: { not: null } },
    _count: true,
    having: { channelReservationId: { _count: { gt: 1 } } },
  });
  console.log(`\nRéférences plateforme en double sur ce bien : ${refs.length}`);
}
main().finally(() => prisma.$disconnect());
