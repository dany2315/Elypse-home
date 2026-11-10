/**
 * Contrôle de cohérence des vues Finances (lecture seule) : pour chaque mode, la somme
 * des mois de l'année égale le total annuel et la somme des biens égale le total.
 *   pnpm tsx --env-file=.env scripts/finances-check-views.ts 2026
 */
import { prisma } from "../src/lib/db";
import { eur } from "../src/lib/finances/filters";
import { loadReport } from "../src/lib/finances/load";
import { buildSections } from "../src/lib/finances/views";

async function main() {
  const year = Number(process.argv[2] ?? 2026);
  let ok = true;
  for (const mode of ["sejour", "arrivee", "reservation"] as const) {
    const f = { periode: "annee" as const, year, month: 1, bien: "tous", mode, annulations: "versement" as const, occ: true, from: "", to: "" };
    const r = await loadReport(f);
    const sumMonths = Object.values(r.totalByMonth).reduce((a, t) => a + t.payout, 0);
    const sumRows = r.rows.reduce((a, t) => a + t.totals.payout, 0);
    const sumChannels = r.byChannel.reduce((a, c) => a + c.totals.payout, 0);
    const monthly = await Promise.all(
      Array.from({ length: 12 }, (_, i) => loadReport({ ...f, periode: "mois", month: i + 1 }).then((m) => m.total.payout)),
    );
    const sumMonthViews = monthly.reduce((a, b) => a + b, 0);
    const good = sumMonths === r.total.payout && sumRows === r.total.payout && sumChannels === r.total.payout && sumMonthViews === r.total.payout;
    ok &&= good;
    const sections = buildSections(r, f);
    console.log(
      `${mode.padEnd(11)} versement ${eur(r.total.payout)} · mois ${eur(sumMonths)} · biens ${eur(sumRows)} · plateformes ${eur(sumChannels)} · vues mensuelles ${eur(sumMonthViews)} · occupation ${((r.total.occupiedNights / r.total.availableNights) * 100).toFixed(1)} % · sections : ${sections.main.map((s) => s.id).join(", ")} ${good ? "✓" : "✗"}`,
    );
  }
  if (!ok) process.exitCode = 1;
}
main().finally(() => prisma.$disconnect());
