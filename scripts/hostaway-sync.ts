/**
 * Synchronisation Hostaway → base du .env (lecture seule côté Hostaway).
 *
 *   pnpm hostaway:sync          # incrémentale (détails financiers des réservations modifiées)
 *   pnpm hostaway:sync --full   # relit le détail financier de toutes les réservations
 *   pnpm hostaway:sync --remap  # recalcule les montants depuis les données stockées (aucun appel Hostaway)
 */
import { prisma } from "../src/lib/db";
import { remapReservations, syncHostaway } from "../src/lib/finances/sync";

async function main() {
  if (process.argv.includes("--remap")) {
    console.log(`${await remapReservations()} réservations recalculées`);
    return;
  }
  const full = process.argv.includes("--full");
  const host = new URL(process.env.DATABASE_URL!).host.split(".")[0];
  console.log(`Base : ${host} — synchro ${full ? "complète" : "incrémentale"}`);
  const r = await syncHostaway({ full, force: process.argv.includes("--force"), log: (m) => console.log(m) });
  console.log(r);
  if (r.status === "error" || r.status === "locked") process.exitCode = 1;
}
main().finally(() => prisma.$disconnect());
