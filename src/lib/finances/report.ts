/**
 * Calcul du récapitulatif financier (module pur : ni base, ni réseau, ni date courante).
 *
 * Rattachement au mois :
 *  - "sejour"      : montants à la nuit répartis au prorata des nuits passées dans chaque
 *                    mois ; ménage (montant par séjour) au mois d'arrivée ; séjours à venir inclus.
 *  - "arrivee"     : tout au mois d'arrivée.
 *  - "reservation" : tout au mois de la date de réservation.
 * Les montants sont en centimes ; la répartition utilise un arrondi cumulé pour que la
 * somme des mois redonne exactement le montant de la réservation.
 */

export type Mode = "sejour" | "arrivee" | "reservation";
export type CancelFilter = "versement" | "toutes" | "aucune";

export const MODES: { value: Mode; label: string }[] = [
  { value: "sejour", label: "Séjours du mois" },
  { value: "arrivee", label: "Arrivées du mois" },
  { value: "reservation", label: "Réservations faites dans le mois" },
];

export const CANCEL_FILTERS: { value: CancelFilter; label: string }[] = [
  { value: "versement", label: "Annulations avec versement" },
  { value: "toutes", label: "Inclure toutes les annulations" },
  { value: "aucune", label: "Exclure les annulations" },
];

export type ReportReservation = {
  id: number;
  listingId: number;
  channel: string;
  channelReservationId?: string | null;
  status: string;
  /** AAAA-MM-JJ */
  arrival: string;
  /** AAAA-MM-JJ (jour du départ, non compté comme nuit) */
  departure: string;
  /** AAAA-MM-JJ */
  reservationDate: string | null;
  nights: number;
  revenueCents: number;
  commissionCents: number;
  paymentFeesCents: number;
  payoutCents: number;
  cityTaxCents: number;
  cleaningFeeCents: number;
};

export type ReportBien = { id: string; name: string; listingIds: number[] };

export type Period = { year: number; month?: number };

export type Totals = {
  revenue: number;
  commission: number;
  paymentFees: number;
  payout: number;
  cityTax: number;
  cleaning: number;
  stays: number;
  nights: number;
  /** Nuits occupées dans la période (calendrier, quel que soit le mode). */
  occupiedNights: number;
  /** Nuits du calendrier de la période × nombre de biens. */
  availableNights: number;
};

export type ReportRow = { key: string; name: string; totals: Totals; byMonth: Record<string, Totals> };

export type Report = {
  months: string[];
  rows: ReportRow[];
  total: Totals;
  totalByMonth: Record<string, Totals>;
  byChannel: { channel: string; totals: Totals }[];
  /** Réservations ignorées car déjà comptées (même référence plateforme). */
  duplicates: number;
  cancelledIncluded: number;
  cancelledExcluded: number;
};

export type ReportInput = {
  reservations: ReportReservation[];
  biens: ReportBien[];
  /** Noms des listings non rattachés à un bien. */
  listingNames?: Record<number, string>;
  period: Period;
  mode: Mode;
  cancellations: CancelFilter;
  /** Limiter à un bien (id de bien, ou "listing:<id>"). */
  groupKey?: string;
};

const CONFIRMED = new Set(["new", "modified"]);
const DAY = 86_400_000;

/* --------------------------------- Dates --------------------------------- */

const toUtc = (d: string) => Date.parse(`${d.slice(0, 10)}T00:00:00Z`);
export const monthKey = (d: string) => d.slice(0, 7);
const monthStart = (key: string) => Date.parse(`${key}-01T00:00:00Z`);
const nextMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
const daysInMonth = (key: string) => Math.round((monthStart(nextMonth(key)) - monthStart(key)) / DAY);

export function periodMonths(p: Period): string[] {
  if (p.month) return [`${p.year}-${String(p.month).padStart(2, "0")}`];
  return Array.from({ length: 12 }, (_, i) => `${p.year}-${String(i + 1).padStart(2, "0")}`);
}

/** Nuits de [arrivée, départ[ passées dans chaque mois. */
export function nightsByMonth(arrival: string, departure: string): Map<string, number> {
  const out = new Map<string, number>();
  const a = toUtc(arrival);
  const d = toUtc(departure);
  for (let key = monthKey(arrival); monthStart(key) < d; key = nextMonth(key)) {
    const from = Math.max(a, monthStart(key));
    const to = Math.min(d, monthStart(nextMonth(key)));
    const n = Math.round((to - from) / DAY);
    if (n > 0) out.set(key, n);
  }
  return out;
}

/* ------------------------------ Répartition ------------------------------ */

type Share = {
  month: string;
  revenue: number;
  commission: number;
  paymentFees: number;
  cityTax: number;
  cleaning: number;
  nights: number;
};

/** Répartit `amount` selon des poids, avec arrondi cumulé (somme exacte). */
function split(amount: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return weights.map((_, i) => (i === 0 ? amount : 0));
  let cum = 0;
  let prev = 0;
  return weights.map((w) => {
    cum += w;
    const next = Math.round((amount * cum) / total);
    const part = next - prev;
    prev = next;
    return part;
  });
}

export function allocate(r: ReportReservation, mode: Mode): Share[] {
  const whole = (month: string): Share[] => [
    {
      month,
      revenue: r.revenueCents,
      commission: r.commissionCents,
      paymentFees: r.paymentFeesCents,
      cityTax: r.cityTaxCents,
      cleaning: r.cleaningFeeCents,
      nights: r.nights,
    },
  ];
  if (mode === "arrivee") return whole(monthKey(r.arrival));
  if (mode === "reservation") return whole(monthKey(r.reservationDate ?? r.arrival));

  const byMonth = nightsByMonth(r.arrival, r.departure);
  if (byMonth.size <= 1) return whole(monthKey(r.arrival));

  const months = [...byMonth.keys()];
  const weights = months.map((m) => byMonth.get(m)!);
  // Le ménage (montant par séjour) va au mois d'arrivée ; le reste des revenus est réparti à la nuit.
  const nightlyRevenue = split(r.revenueCents - r.cleaningFeeCents, weights);
  const commission = split(r.commissionCents, weights);
  const paymentFees = split(r.paymentFeesCents, weights);
  const cityTax = split(r.cityTaxCents, weights);
  const arrivalMonth = monthKey(r.arrival);
  return months.map((month, i) => ({
    month,
    revenue: nightlyRevenue[i] + (month === arrivalMonth ? r.cleaningFeeCents : 0),
    commission: commission[i],
    paymentFees: paymentFees[i],
    cityTax: cityTax[i],
    cleaning: month === arrivalMonth ? r.cleaningFeeCents : 0,
    nights: weights[i],
  }));
}

/* -------------------------------- Agrégats -------------------------------- */

class Bucket {
  revenue = 0;
  commission = 0;
  paymentFees = 0;
  cityTax = 0;
  cleaning = 0;
  nights = 0;
  occupiedNights = 0;
  ids = new Set<number>();

  add(s: Share, id: number) {
    this.revenue += s.revenue;
    this.commission += s.commission;
    this.paymentFees += s.paymentFees;
    this.cityTax += s.cityTax;
    this.cleaning += s.cleaning;
    this.nights += s.nights;
    this.ids.add(id);
  }

  totals(availableNights: number): Totals {
    return {
      revenue: this.revenue,
      commission: this.commission,
      paymentFees: this.paymentFees,
      // Versement dérivé : identique à la somme des versements des réservations.
      payout: this.revenue - this.commission - this.paymentFees,
      cityTax: this.cityTax,
      cleaning: this.cleaning,
      stays: this.ids.size,
      nights: this.nights,
      occupiedNights: this.occupiedNights,
      availableNights,
    };
  }
}

export function emptyTotals(): Totals {
  return new Bucket().totals(0);
}

/** Garde une seule réservation par référence plateforme (préférence : confirmée, puis id le plus récent). */
export function dedupe(list: ReportReservation[]): { kept: ReportReservation[]; duplicates: number } {
  const byKey = new Map<string, ReportReservation>();
  const seenIds = new Set<number>();
  let duplicates = 0;
  for (const r of list) {
    if (seenIds.has(r.id)) {
      duplicates++;
      continue;
    }
    seenIds.add(r.id);
    const key = r.channelReservationId ? `${r.channel}:${r.channelReservationId}` : `id:${r.id}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, r);
      continue;
    }
    duplicates++;
    const better = (CONFIRMED.has(r.status) ? 1 : 0) - (CONFIRMED.has(prev.status) ? 1 : 0) || r.id - prev.id;
    if (better > 0) byKey.set(key, r);
  }
  return { kept: [...byKey.values()], duplicates };
}

export function isIncluded(r: ReportReservation, filter: CancelFilter): boolean {
  if (CONFIRMED.has(r.status)) return true;
  if (r.status !== "cancelled") return false;
  if (filter === "toutes") return true;
  if (filter === "aucune") return false;
  return r.payoutCents !== 0;
}

export function buildReport(input: ReportInput): Report {
  const months = periodMonths(input.period);
  const monthSet = new Set(months);

  // Groupes : biens, puis listings non rattachés.
  const groupOfListing = new Map<number, string>();
  const groupNames = new Map<string, string>();
  for (const b of input.biens) {
    groupNames.set(b.id, b.name);
    for (const l of b.listingIds) groupOfListing.set(l, b.id);
  }
  const groupOf = (listingId: number) => {
    const g = groupOfListing.get(listingId);
    if (g) return g;
    const key = `listing:${listingId}`;
    if (!groupNames.has(key)) groupNames.set(key, input.listingNames?.[listingId] ?? `Listing ${listingId}`);
    return key;
  };

  const { kept, duplicates } = dedupe(input.reservations);
  const buckets = new Map<string, Bucket>();
  const bucket = (k: string) => buckets.get(k) ?? buckets.set(k, new Bucket()).get(k)!;
  const usedGroups = new Set<string>(input.biens.map((b) => b.id));

  let cancelledIncluded = 0;
  let cancelledExcluded = 0;

  for (const r of kept) {
    const group = groupOf(r.listingId);
    if (input.groupKey && group !== input.groupKey) continue;

    // Occupation (calendrier) : séjours confirmés uniquement, quel que soit le mode.
    if (CONFIRMED.has(r.status)) {
      for (const [m, n] of nightsByMonth(r.arrival, r.departure)) {
        if (!monthSet.has(m)) continue;
        usedGroups.add(group);
        for (const k of [`${group}|${m}`, `${group}|*`, `*|${m}`, "*|*"]) bucket(k).occupiedNights += n;
      }
    }

    const shares = allocate(r, input.mode).filter((s) => monthSet.has(s.month));
    if (!shares.length) continue; // hors période pour ce mode
    const included = isIncluded(r, input.cancellations);
    if (r.status === "cancelled") {
      if (included) cancelledIncluded++;
      else cancelledExcluded++;
    }
    if (!included) continue;

    for (const s of shares) {
      if (!monthSet.has(s.month)) continue;
      usedGroups.add(group);
      for (const k of [`${group}|${s.month}`, `${group}|*`, `*|${s.month}`, "*|*", `ch:${r.channel}`]) bucket(k).add(s, r.id);
    }
  }

  const days = months.reduce((a, m) => a + daysInMonth(m), 0);
  const groups = [...usedGroups].filter((g) => !input.groupKey || g === input.groupKey);
  const get = (k: string, available: number) => (buckets.get(k) ?? new Bucket()).totals(available);

  const order = new Map(input.biens.map((b, i) => [b.id, i]));
  const rows: ReportRow[] = groups
    .map((g) => ({
      key: g,
      name: groupNames.get(g) ?? g,
      totals: get(`${g}|*`, days),
      byMonth: Object.fromEntries(months.map((m) => [m, get(`${g}|${m}`, daysInMonth(m))])),
    }))
    .sort((a, b) => (order.get(a.key) ?? 1e9) - (order.get(b.key) ?? 1e9) || a.name.localeCompare(b.name, "fr"));

  const byChannel = [...buckets.keys()]
    .filter((k) => k.startsWith("ch:"))
    .map((k) => ({ channel: k.slice(3), totals: get(k, 0) }))
    .sort((a, b) => b.totals.revenue - a.totals.revenue);

  return {
    months,
    rows,
    total: get("*|*", days * groups.length),
    totalByMonth: Object.fromEntries(months.map((m) => [m, get(`*|${m}`, daysInMonth(m) * groups.length)])),
    byChannel,
    duplicates,
    cancelledIncluded,
    cancelledExcluded,
  };
}

/* ------------------------------- Affichage ------------------------------- */

const CHANNEL_LABELS: Record<string, string> = {
  airbnbOfficial: "Airbnb",
  airbnb: "Airbnb",
  bookingcom: "Booking.com",
  direct: "Direct",
  vrboical: "Vrbo",
  homeaway: "Vrbo",
  expedia: "Expedia",
  google: "Google",
};
export const channelLabel = (c: string) => CHANNEL_LABELS[c] ?? c;

export const occupancy = (t: Totals) => (t.availableNights > 0 ? t.occupiedNights / t.availableNights : null);
