/** Filtres de la page Finances (lus depuis l'URL) et formatage — module pur. */
import { CANCEL_FILTERS, MODES, type Bucket, type CancelFilter, type Mode, type Period } from "./report";

export type Periode = "mois" | "annee" | "dates";

export type FinanceFilters = {
  periode: Periode;
  year: number;
  month: number;
  /** Intervalle (periode = "dates") : AAAA-MM-JJ, bornes incluses. */
  from: string;
  to: string;
  /** "tous" ou clé de groupe (id de bien ou "listing:<id>"). */
  bien: string;
  mode: Mode;
  annulations: CancelFilter;
  /** Afficher l'occupation. */
  occ: boolean;
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Durée maximale d'un intervalle (≈ 5 ans). */
const MAX_RANGE_DAYS = 5 * 366;

/** Date du jour à Paris (AAAA-MM-JJ). */
export function todayInParis(now = new Date()): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(now);
}

/** AAAA-MM-JJ valide (date réelle) ou null. */
export function validDate(v: string | undefined): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== v ? null : v;
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export function parseFilters(sp: SearchParams, today = todayInParis()): FinanceFilters {
  const [ty, tm] = today.split("-").map(Number);
  const year = Number(one(sp.annee));
  const month = Number(one(sp.mois));
  const mode = one(sp.mode);
  const annulations = one(sp.annulations);
  const periode = one(sp.periode);

  // Intervalle : par défaut du 1er du mois à aujourd'hui ; bornes inversées remises dans l'ordre.
  let from = validDate(one(sp.du)) ?? `${today.slice(0, 7)}-01`;
  let to = validDate(one(sp.au)) ?? today;
  if (to < from) [from, to] = [to, from];
  if (dayDiff(from, to) > MAX_RANGE_DAYS) to = new Date(Date.parse(`${from}T00:00:00Z`) + MAX_RANGE_DAYS * 86_400_000).toISOString().slice(0, 10);

  return {
    periode: periode === "annee" || periode === "dates" ? periode : "mois",
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : ty,
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : tm,
    from,
    to,
    bien: one(sp.bien) || "tous",
    mode: MODES.some((m) => m.value === mode) ? (mode as Mode) : "sejour",
    annulations: CANCEL_FILTERS.some((c) => c.value === annulations) ? (annulations as CancelFilter) : "versement",
    occ: one(sp.occ) === "1",
  };
}

export function toSearchParams(f: FinanceFilters): URLSearchParams {
  const p = new URLSearchParams({ periode: f.periode });
  if (f.periode === "dates") {
    p.set("du", f.from);
    p.set("au", f.to);
  } else {
    p.set("annee", String(f.year));
    if (f.periode === "mois") p.set("mois", String(f.month));
  }
  if (f.bien !== "tous") p.set("bien", f.bien);
  if (f.mode !== "sejour") p.set("mode", f.mode);
  if (f.annulations !== "versement") p.set("annulations", f.annulations);
  if (f.occ) p.set("occ", "1");
  return p;
}

export const toPeriod = (f: FinanceFilters): Period =>
  f.periode === "dates" ? { from: f.from, to: f.to } : f.periode === "annee" ? { year: f.year } : { year: f.year, month: f.month };

/** Libellé du mode adapté à la période (« du mois » ou « de la période »). */
export function modeLabel(mode: Mode, periode: Periode): string {
  const label = MODES.find((m) => m.value === mode)!.label;
  return periode === "mois" ? label : label.replace("dans le mois", "dans la période").replace("du mois", "de la période");
}

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

/** "2026-10-15" → "15/10/2026" */
export const shortDate = (d: string) => d.split("-").reverse().join("/");

/** Libellé d'une tranche : « octobre 2026 », ou « du 15 au 31 octobre 2026 » si elle est coupée. */
export function bucketLabel(b: Bucket, withYear: boolean): string {
  const month = monthLabel(b.key, withYear);
  if (!b.partial) return month;
  const first = Number(b.start.slice(8));
  const last = first + b.days - 1;
  const day = (d: number) => (d === 1 ? "1er" : String(d));
  return first === last ? `${day(first)} ${month}` : `du ${day(first)} au ${last} ${month}`;
}

export function periodLabel(f: FinanceFilters): string {
  if (f.periode === "dates") return f.from === f.to ? `Le ${shortDate(f.from)}` : `Du ${shortDate(f.from)} au ${shortDate(f.to)}`;
  return f.periode === "annee" ? `Année ${f.year}` : monthLabel(`${f.year}-${String(f.month).padStart(2, "0")}`);
}

/** Suffixe de nom de fichier pour l'export. */
export function periodSlug(f: FinanceFilters): string {
  if (f.periode === "dates") return `${f.from}_${f.to}`;
  return f.periode === "annee" ? String(f.year) : `${f.year}-${String(f.month).padStart(2, "0")}`;
}

/** Montant CSV : 1234,56 (sans séparateur de milliers, pour les tableurs). */
export const csvAmount = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
