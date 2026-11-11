/** Données des graphiques Finances — module pur. */
import { bucketLabel, MONTH_NAMES, type FinanceFilters } from "./filters";
import { channelLabel, type Report } from "./report";

export type ChartTrendPoint = {
  key: string;
  label: string;
  shortLabel: string;
  payout: number;
  fees: number;
  cityTax: number;
  stays: number;
  highlight?: boolean;
};

const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

/**
 * Filtres du graphique d'évolution. Année, ou intervalle sur plusieurs mois : la période
 * elle-même (null). Mois seul, ou intervalle dans un seul mois : les 12 mois qui se terminent
 * par ce mois, pour donner le contexte.
 */
export function trendFilters(f: FinanceFilters): { filters: FinanceFilters; highlight: string[] } | null {
  if (f.periode === "annee") return null;
  if (f.periode === "dates" && f.from.slice(0, 7) !== f.to.slice(0, 7)) return null;
  const [y, m] = (f.periode === "mois" ? `${f.year}-${String(f.month).padStart(2, "0")}` : f.to.slice(0, 7)).split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 12, 1)).toISOString().slice(0, 10);
  return {
    filters: { ...f, periode: "dates", from: start, to: lastDay(y, m) },
    highlight: [`${y}-${String(m).padStart(2, "0")}`],
  };
}

export function trendPoints(report: Report, highlight: string[] = []): ChartTrendPoint[] {
  const years = new Set(report.buckets.map((b) => b.key.slice(0, 4)));
  return report.buckets.map((b, i) => {
    const t = report.totalByMonth[b.key];
    const [y, m] = b.key.split("-").map(Number);
    const abbr = MONTH_NAMES[m - 1].length > 4 ? `${MONTH_NAMES[m - 1].slice(0, 4).replace(/é$/, "é")}.` : MONTH_NAMES[m - 1];
    // Année ajoutée au premier mois et à chaque janvier quand la période couvre deux années.
    const shortLabel = years.size > 1 && (i === 0 || m === 1) ? `${abbr} ${String(y).slice(2)}` : abbr;
    return {
      key: b.key,
      label: bucketLabel(b, true),
      shortLabel,
      payout: t.payout,
      fees: t.commission + t.paymentFees,
      cityTax: t.cityTax,
      stays: t.stays,
      highlight: highlight.includes(b.key),
    };
  });
}

export function bienBars(report: Report) {
  return report.rows.map((r) => ({
    key: r.key,
    label: r.name,
    value: r.totals.payout,
    detail: `${r.totals.stays} séjour${r.totals.stays > 1 ? "s" : ""} · ${r.totals.nights} nuits`,
  }));
}

export function channelShares(report: Report) {
  return report.byChannel.map((c) => ({ key: c.channel, label: channelLabel(c.channel), value: c.totals.revenue }));
}
