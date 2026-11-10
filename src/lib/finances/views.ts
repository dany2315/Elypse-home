/** Tableaux affichés (et exportés en CSV) pour une vue — module pur. */
import { monthLabel, type FinanceFilters } from "./filters";
import { channelLabel, type Report, type Totals } from "./report";

export type ViewRow = { key: string; label: string; totals: Totals; muted?: boolean };
export type ViewSection = { id: string; title: string; firstColumn: string; rows: ViewRow[]; total: Totals };

const isEmpty = (t: Totals) => t.stays === 0 && t.revenue === 0 && t.occupiedNights === 0;

export function buildSections(report: Report, f: FinanceFilters): { main: ViewSection[]; channels: ViewSection } {
  const perBien: ViewSection = {
    id: "biens",
    title: f.periode === "annee" ? `Par bien — année ${f.year}` : "Par bien",
    firstColumn: "Bien",
    rows: report.rows.map((r) => ({ key: r.key, label: r.name, totals: r.totals, muted: isEmpty(r.totals) })),
    total: report.total,
  };
  const perMonth: ViewSection = {
    id: "mois",
    title: f.bien === "tous" ? "Détail mois par mois — tous les biens" : `Détail mois par mois — ${report.rows[0]?.name ?? ""}`,
    firstColumn: "Mois",
    rows: report.months.map((m) => ({
      key: m,
      label: monthLabel(m, false),
      totals: report.totalByMonth[m],
      muted: isEmpty(report.totalByMonth[m]),
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

  let main: ViewSection[];
  if (f.periode === "mois") main = [perBien];
  else if (f.bien === "tous") main = [perBien, perMonth];
  else main = [perMonth];
  return { main, channels };
}
