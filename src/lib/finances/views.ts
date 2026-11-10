/** Tableaux affichés (et exportés en CSV) pour une vue — module pur. */
import { bucketLabel, periodLabel, type FinanceFilters } from "./filters";
import { channelLabel, type Report, type Totals } from "./report";

export type ViewRow = { key: string; label: string; totals: Totals; muted?: boolean };
export type ViewSection = { id: string; title: string; firstColumn: string; rows: ViewRow[]; total: Totals };

const isEmpty = (t: Totals) => t.stays === 0 && t.revenue === 0 && t.occupiedNights === 0;

export function buildSections(report: Report, f: FinanceFilters): { main: ViewSection[]; channels: ViewSection } {
  const multiYear = new Set(report.buckets.map((b) => b.key.slice(0, 4))).size > 1;
  const perBien: ViewSection = {
    id: "biens",
    title: f.periode === "mois" ? "Par bien" : `Par bien — ${periodLabel(f).replace(/^\w/, (c) => c.toLowerCase())}`,
    firstColumn: "Bien",
    rows: report.rows.map((r) => ({ key: r.key, label: r.name, totals: r.totals, muted: isEmpty(r.totals) })),
    total: report.total,
  };
  const perMonth: ViewSection = {
    id: "mois",
    title: f.bien === "tous" ? "Détail mois par mois — tous les biens" : `Détail mois par mois — ${report.rows[0]?.name ?? ""}`,
    firstColumn: "Mois",
    rows: report.buckets.map((b) => ({
      key: b.key,
      // Année affichée seulement si la période en couvre plusieurs (intervalle de dates).
      label: bucketLabel(b, multiYear || (f.periode === "dates" && b.partial)),
      totals: report.totalByMonth[b.key],
      muted: isEmpty(report.totalByMonth[b.key]),
    })),
    total: report.total,
  };
  const channels: ViewSection = {
    id: "plateformes",
    title: "Répartition par plateforme",
    firstColumn: "Plateforme",
    rows: report.byChannel.map((c) => ({ key: c.channel, label: channelLabel(c.channel), totals: c.totals })),
    total: { ...report.total, occupiedNights: 0, availableNights: 0 },
  };

  const showMonths = f.periode === "annee" || (f.periode === "dates" && report.buckets.length > 1);
  let main: ViewSection[];
  if (!showMonths) main = [perBien];
  else if (f.bien === "tous") main = [perBien, perMonth];
  else main = [perMonth];
  return { main, channels };
}
