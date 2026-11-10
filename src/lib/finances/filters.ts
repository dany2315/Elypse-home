/** Filtres de la page Finances (lus depuis l'URL) et formatage — module pur. */
import { CANCEL_FILTERS, MODES, type CancelFilter, type Mode, type Period } from "./report";

export type FinanceFilters = {
  periode: "mois" | "annee";
  year: number;
  month: number;
  /** "tous" ou clé de groupe (id de bien ou "listing:<id>"). */
  bien: string;
  mode: Mode;
  annulations: CancelFilter;
  /** Afficher l'occupation. */
  occ: boolean;
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Date du jour à Paris (AAAA-MM-JJ). */
export function todayInParis(now = new Date()): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(now);
}

export function parseFilters(sp: SearchParams, today = todayInParis()): FinanceFilters {
  const [ty, tm] = today.split("-").map(Number);
  const year = Number(one(sp.annee));
  const month = Number(one(sp.mois));
  const mode = one(sp.mode);
  const annulations = one(sp.annulations);
  return {
    periode: one(sp.periode) === "annee" ? "annee" : "mois",
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : ty,
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : tm,
    bien: one(sp.bien) || "tous",
    mode: MODES.some((m) => m.value === mode) ? (mode as Mode) : "sejour",
    annulations: CANCEL_FILTERS.some((c) => c.value === annulations) ? (annulations as CancelFilter) : "versement",
    occ: one(sp.occ) === "1",
  };
}

export function toSearchParams(f: FinanceFilters): URLSearchParams {
  const p = new URLSearchParams({ periode: f.periode, annee: String(f.year) });
  if (f.periode === "mois") p.set("mois", String(f.month));
  if (f.bien !== "tous") p.set("bien", f.bien);
  if (f.mode !== "sejour") p.set("mode", f.mode);
  if (f.annulations !== "versement") p.set("annulations", f.annulations);
  if (f.occ) p.set("occ", "1");
  return p;
}

export const toPeriod = (f: FinanceFilters): Period =>
  f.periode === "annee" ? { year: f.year } : { year: f.year, month: f.month };

/* -------------------------------- Formatage ------------------------------- */

const eurFormat = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const pctFormat = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });
const intFormat = new Intl.NumberFormat("fr-FR");

/** Montant en euros au format français (les espaces fines insécables deviennent des espaces insécables). */
export const eur = (cents: number) => eurFormat.format(cents / 100).replace(/ /g, " ");
export const pct = (v: number | null) => (v === null ? "—" : pctFormat.format(v).replace(/ /g, " "));
export const int = (v: number) => intFormat.format(v).replace(/ /g, " ");

export const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** "2026-10" → "octobre 2026" */
export function monthLabel(key: string, withYear = true): string {
  const [y, m] = key.split("-").map(Number);
  return withYear ? `${MONTH_NAMES[m - 1]} ${y}` : MONTH_NAMES[m - 1];
}

export function periodLabel(f: FinanceFilters): string {
  return f.periode === "annee" ? `Année ${f.year}` : monthLabel(`${f.year}-${String(f.month).padStart(2, "0")}`);
}

/** Montant CSV : 1234,56 (sans séparateur de milliers, pour les tableurs). */
export const csvAmount = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
