/**
 * Charges fixes par bien (loyer, leasing mobilier, électricité…) — module pur.
 *
 * Une charge est un montant mensuel hors taxes avec un taux de TVA. Son historique est fait de
 * versions datées, jamais modifiées : « à partir du 1er mars, 1 250 € » crée une version qui
 * commence le 1er mars, sans toucher aux mois précédents. Sur un même jour, la version saisie en
 * dernier l'emporte ; une version avec une date de fin laisse reprendre la précédente après elle.
 *
 * Dans un rapport, le montant mensuel est réparti au jour : un mois entier compte le montant
 * exact, le 1er au 15 novembre en compte 15/30.
 */

export type ChargeCategory = "loyer" | "leasing" | "electricite" | "internet" | "assurance" | "copropriete" | "menage" | "autre";

export const CHARGE_CATEGORIES: { value: ChargeCategory; label: string }[] = [
  { value: "loyer", label: "Loyer" },
  { value: "leasing", label: "Leasing mobilier" },
  { value: "electricite", label: "Électricité" },
  { value: "internet", label: "Internet" },
  { value: "assurance", label: "Assurance" },
  { value: "copropriete", label: "Charges de copropriété" },
  { value: "menage", label: "Ménage" },
  { value: "autre", label: "Autre" },
];

export const chargeCategoryLabel = (c: string) => CHARGE_CATEGORIES.find((x) => x.value === c)?.label ?? "Autre";
export const isChargeCategory = (c: string): c is ChargeCategory => CHARGE_CATEGORIES.some((x) => x.value === c);

/** Taux de TVA proposés, en points de base (2000 = 20 %). */
export const VAT_RATES: { value: number; label: string }[] = [
  { value: 2000, label: "20 %" },
  { value: 1000, label: "10 %" },
  { value: 550, label: "5,5 %" },
  { value: 210, label: "2,1 %" },
  { value: 0, label: "0 % (sans TVA)" },
];
export const vatRateLabel = (bp: number) =>
  VAT_RATES.find((r) => r.value === bp)?.label.replace(/ \(.*\)$/, "") ?? `${(bp / 100).toLocaleString("fr-FR")} %`;

export const vatOf = (htCents: number, rateBp: number) => Math.round((htCents * rateBp) / 10_000);
export const ttcOf = (htCents: number, rateBp: number) => htCents + vatOf(htCents, rateBp);
/** Hors taxes à partir d'un montant TTC. */
export const htFromTtc = (ttcCents: number, rateBp: number) => Math.round((ttcCents * 10_000) / (10_000 + rateBp));

export type ChargeVersion = {
  id: string;
  /** Premier jour (AAAA-MM-JJ). */
  start: string;
  /** Dernier jour inclus (AAAA-MM-JJ), null = sans fin. */
  end: string | null;
  /** Montant mensuel hors taxes, en centimes (0 = charge arrêtée). */
  amountCents: number;
  vatRateBp: number;
  /** Date de saisie (ISO) : départage les versions qui se chevauchent. */
  createdAt: string;
  /** Note libre (« nouveau bail »…). */
  note?: string;
};

export type ReportCharge = { id: string; bienId: string; category: string; label: string; versions: ChargeVersion[] };

/** Période où une version s'applique réellement (après résolution des chevauchements). */
export type ChargeSegment = {
  versionId: string;
  start: string;
  /** Dernier jour inclus, null = sans fin. */
  end: string | null;
  amountCents: number;
  vatRateBp: number;
};

const DAY = 86_400_000;
const toUtc = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fromUtc = (t: number) => new Date(t).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => fromUtc(toUtc(d) + n * DAY);
const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY);
const daysInMonth = (d: string) => {
  const [y, m] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** Version la plus récente d'abord (date de saisie, puis id pour un ordre stable). */
const newer = (a: ChargeVersion, b: ChargeVersion) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

/**
 * Montants réellement appliqués, du plus ancien au plus récent. Les périodes contiguës d'une
 * même version sont fusionnées ; un jour sans version n'a pas de charge.
 */
export function chargeSegments(versions: ChargeVersion[]): ChargeSegment[] {
  if (!versions.length) return [];
  const ranked = [...versions].sort(newer);
  const bounds = [...new Set(versions.flatMap((v) => (v.end ? [v.start, addDays(v.end, 1)] : [v.start])))].sort();
  const out: ChargeSegment[] = [];
  bounds.forEach((from, i) => {
    const next = bounds[i + 1];
    const winner = ranked.find((v) => v.start <= from && (v.end === null || v.end >= from));
    if (!winner) return;
    const end = next ? addDays(next, -1) : null;
    const last = out[out.length - 1];
    if (last && last.versionId === winner.id && last.end && addDays(last.end, 1) === from) last.end = end;
    else out.push({ versionId: winner.id, start: from, end, amountCents: winner.amountCents, vatRateBp: winner.vatRateBp });
  });
  return out;
}

/**
 * Charge (HT et TVA, en centimes) pour [start, end[ — un intervalle dans un seul mois
 * calendaire (tranche de rapport). Montant mensuel × jours couverts / jours du mois.
 */
export function chargeInRange(segments: ChargeSegment[], start: string, end: string): { ht: number; vat: number } {
  const dim = daysInMonth(start);
  let ht = 0;
  let vat = 0;
  for (const s of segments) {
    const from = s.start > start ? s.start : start;
    const segEnd = s.end ? addDays(s.end, 1) : end;
    const to = segEnd < end ? segEnd : end;
    const days = daysBetween(from, to);
    if (days <= 0 || s.amountCents === 0) continue;
    const part = (s.amountCents * days) / dim;
    ht += part;
    vat += (part * s.vatRateBp) / 10_000;
  }
  return { ht: Math.round(ht), vat: Math.round(vat) };
}

/** Montant en vigueur un jour donné (null : pas de charge ce jour-là). */
export function segmentAt(segments: ChargeSegment[], day: string): ChargeSegment | null {
  return segments.find((s) => s.start <= day && (s.end === null || s.end >= day)) ?? null;
}

/** Prochain changement après `day` (montant à venir), s'il existe. */
export function nextSegment(segments: ChargeSegment[], day: string): ChargeSegment | null {
  return segments.find((s) => s.start > day) ?? null;
}

/** Charge d'un mois entier (AAAA-MM) : HT, TVA, TTC. */
export function chargeForMonth(segments: ChargeSegment[], month: string): { ht: number; vat: number; ttc: number } {
  const start = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const { ht, vat } = chargeInRange(segments, start, end);
  return { ht, vat, ttc: ht + vat };
}

/** « 1 250,50 » / « 1250.5 » / « 1 250 € » → 125050 centimes (null si invalide). */
export function parseEuros(input: string): number | null {
  const clean = input.replace(/[\s  €]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}
