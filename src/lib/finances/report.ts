/**
 * Calcul du récapitulatif financier (module pur : ni base, ni réseau, ni date courante).
 *
 * Période : un mois, une année, ou un intervalle de dates (bornes incluses). Elle est
 * découpée en tranches : les mois, coupés aux bornes de l'intervalle.
 *
 * Rattachement :
 *  - "sejour"      : montants à la nuit répartis au prorata des nuits passées dans chaque
 *                    tranche ; ménage (montant par séjour) à la tranche du jour d'arrivée ;
 *                    séjours à venir inclus.
 *  - "arrivee"     : tout à la tranche du jour d'arrivée.
 *  - "reservation" : tout à la tranche de la date de réservation.
 * Montants en centimes. Le prorata est arrondi en cumulé depuis l'arrivée : la somme des
 * tranches (et de périodes adjacentes) redonne exactement le montant de la réservation.
 */

export type Mode = "sejour" | "arrivee" | "reservation";
export type CancelFilter = "versement" | "toutes" | "aucune";

/**
 * Libellés pour l'utilisateur : `label` = bouton, `summary` = rappel sous les KPI et dans l'export,
 * `hint` = explication affichée sous le filtre.
 */
export const MODES: { value: Mode; label: string; summary: string; hint: string }[] = [
  {
    value: "sejour",
    label: "Nuits passées",
    summary: "séjours comptés selon les nuits passées dans le mois",
    hint: "Chaque mois reçoit la part du séjour correspondant aux nuits passées dedans : un séjour du 29 octobre au 3 novembre compte 3 nuits en octobre et 2 en novembre, et son montant est partagé pareil. Le ménage compte au mois d'arrivée.",
  },
  {
    value: "arrivee",
    label: "Date d'arrivée",
    summary: "séjours comptés au mois d'arrivée",
    hint: "Tout le séjour (nuits et montants) compte dans le mois où le voyageur arrive, même s'il repart le mois suivant. C'est le réglage « Arrivée » du rapport Hostaway : à choisir pour comparer avec lui.",
  },
  {
    value: "reservation",
    label: "Date de réservation",
    summary: "séjours comptés au mois où ils ont été réservés",
    hint: "Tout le séjour compte le jour où le voyageur a réservé, même s'il vient des mois plus tard. Utile pour suivre les ventes, pas l'activité.",
  },
];

export const CANCEL_FILTERS: { value: CancelFilter; label: string; summary: string; hint: string }[] = [
  {
    value: "versement",
    label: "Si elles rapportent",
    summary: "annulations comptées seulement si elles rapportent",
    hint: "Une réservation annulée compte seulement si la plateforme vous verse quelque chose (frais d'annulation retenus au voyageur). Les annulations gratuites sont ignorées. Recommandé.",
  },
  {
    value: "toutes",
    label: "Toutes",
    summary: "toutes les annulations comptées",
    hint: "Toutes les réservations annulées comptent, même celles qui ne rapportent rien : elles s'ajoutent au nombre de séjours et de nuits.",
  },
  {
    value: "aucune",
    label: "Aucune",
    summary: "annulations non comptées",
    hint: "Les réservations annulées sont ignorées, même si la plateforme vous a versé des frais d'annulation.",
  },
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
  /** Remboursements aux voyageurs (résolutions Airbnb), en positif. */
  refundsCents?: number;
  payoutCents: number;
  cityTaxCents: number;
  /** TVA et autres taxes (hors taxe de séjour). */
  vatCents?: number;
  cleaningFeeCents: number;
};

export type ReportBien = { id: string; name: string; listingIds: number[] };

/** Mois (`month`), année entière, ou intervalle `from` → `to` (AAAA-MM-JJ, bornes incluses). */
export type Period = { year: number; month?: number } | { from: string; to: string };

/** Tranche de la période : [start, end[ (AAAA-MM-JJ). `key` = AAAA-MM. */
export type Bucket = { key: string; start: string; end: string; days: number; partial: boolean };

export type Totals = {
  /**
   * Chiffre d'affaires : tout ce que les voyageurs ont payé (nuitées, ménage, frais de service,
   * taxes) = Revenus de location Hostaway. = revenue + cityTax + vat.
   */
  gross: number;
  /** Chiffre d'affaires hors taxes (taxe de séjour et TVA retirées). */
  revenue: number;
  commission: number;
  paymentFees: number;
  /** Remboursements aux voyageurs. */
  refunds: number;
  /**
   * Bénéfice : ce qui reste réellement = CA − commissions − frais de paiement − remboursements
   * − taxe de séjour − TVA (= CA hors taxes − commissions − frais de paiement − remboursements).
   */
  payout: number;
  cityTax: number;
  /** TVA et autres taxes. */
  vat: number;
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
  buckets: Bucket[];
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
const fromUtc = (t: number) => new Date(t).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => fromUtc(toUtc(d) + n * DAY);
const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY);
export const monthKey = (d: string) => d.slice(0, 7);
const nextMonthStart = (d: string) => {
  const [y, m] = d.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
};

/** Bornes [début, fin[ de la période. */
export function periodRange(p: Period): { start: string; end: string } {
  if ("from" in p) return { start: p.from, end: addDays(p.to, 1) };
  if (p.month) {
    const start = `${p.year}-${String(p.month).padStart(2, "0")}-01`;
    return { start, end: nextMonthStart(start) };
  }
  return { start: `${p.year}-01-01`, end: `${p.year + 1}-01-01` };
}

/** Découpe la période en mois, coupés aux bornes. */
export function periodBuckets(p: Period): Bucket[] {
  const { start, end } = periodRange(p);
  const out: Bucket[] = [];
  for (let s = start; s < end; ) {
    const monthEnd = nextMonthStart(s);
    const e = monthEnd < end ? monthEnd : end;
    out.push({ key: monthKey(s), start: s, end: e, days: daysBetween(s, e), partial: s.slice(8) !== "01" || e !== monthEnd });
    s = e;
  }
  return out;
}

/** Nuits de [arrivée, départ[ passées dans chaque mois. */
export function nightsByMonth(arrival: string, departure: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const b of periodBuckets({ from: arrival, to: addDays(departure, -1) })) out.set(b.key, b.days);
  return out;
}

/* ------------------------------ Répartition ------------------------------ */

type Share = {
  bucket: string;
  revenue: number;
  commission: number;
  paymentFees: number;
  refunds: number;
  cityTax: number;
  vat: number;
  cleaning: number;
  nights: number;
};

const bucketOf = (buckets: Bucket[], date: string) => buckets.find((b) => date >= b.start && date < b.end);

/** Part de `amount` pour les nuits [offset, offset + n[ d'un séjour de `total` nuits (arrondi cumulé). */
const slice = (amount: number, offset: number, n: number, total: number) =>
  Math.round((amount * (offset + n)) / total) - Math.round((amount * offset) / total);

/** Répartit une réservation dans les tranches (celles hors période sont ignorées). */
export function allocate(r: ReportReservation, mode: Mode, buckets: Bucket[]): Share[] {
  const whole = (date: string): Share[] => {
    const b = bucketOf(buckets, date);
    if (!b) return [];
    return [
      {
        bucket: b.key,
        revenue: r.revenueCents,
        commission: r.commissionCents,
        paymentFees: r.paymentFeesCents,
        refunds: r.refundsCents ?? 0,
        cityTax: r.cityTaxCents,
        vat: r.vatCents ?? 0,
        cleaning: r.cleaningFeeCents,
        nights: r.nights,
      },
    ];
  };
  if (mode === "arrivee") return whole(r.arrival);
  if (mode === "reservation") return whole(r.reservationDate ?? r.arrival);

  const total = daysBetween(r.arrival, r.departure);
  if (total <= 0) return whole(r.arrival);

  // Le ménage (montant par séjour) va à la tranche d'arrivée ; le reste des revenus est réparti à la nuit.
  const nightlyRevenue = r.revenueCents - r.cleaningFeeCents;
  const arrivalBucket = bucketOf(buckets, r.arrival)?.key;
  const shares: Share[] = [];
  for (const b of buckets) {
    const from = r.arrival > b.start ? r.arrival : b.start;
    const to = r.departure < b.end ? r.departure : b.end;
    const n = daysBetween(from, to);
    if (n <= 0) continue;
    const offset = daysBetween(r.arrival, from);
    const cleaning = b.key === arrivalBucket ? r.cleaningFeeCents : 0;
    shares.push({
      bucket: b.key,
      revenue: slice(nightlyRevenue, offset, n, total) + cleaning,
      commission: slice(r.commissionCents, offset, n, total),
      paymentFees: slice(r.paymentFeesCents, offset, n, total),
      refunds: slice(r.refundsCents ?? 0, offset, n, total),
      cityTax: slice(r.cityTaxCents, offset, n, total),
      vat: slice(r.vatCents ?? 0, offset, n, total),
      cleaning,
      nights: n,
    });
  }
  // Séjour qui ne fait qu'arriver dans la période sans y passer de nuit : rien à compter.
  return shares;
}

/* -------------------------------- Agrégats -------------------------------- */

class Acc {
  revenue = 0;
  commission = 0;
  paymentFees = 0;
  refunds = 0;
  cityTax = 0;
  vat = 0;
  cleaning = 0;
  nights = 0;
  occupiedNights = 0;
  ids = new Set<number>();

  add(s: Share, id: number) {
    this.revenue += s.revenue;
    this.commission += s.commission;
    this.paymentFees += s.paymentFees;
    this.refunds += s.refunds;
    this.cityTax += s.cityTax;
    this.vat += s.vat;
    this.cleaning += s.cleaning;
    this.nights += s.nights;
    this.ids.add(id);
  }

  totals(availableNights: number): Totals {
    return {
      gross: this.revenue + this.cityTax + this.vat,
      revenue: this.revenue,
      commission: this.commission,
      paymentFees: this.paymentFees,
      refunds: this.refunds,
      // Revenu net dérivé : identique à la somme des revenus nets des réservations.
      payout: this.revenue - this.commission - this.paymentFees - this.refunds,
      cityTax: this.cityTax,
      vat: this.vat,
      cleaning: this.cleaning,
      stays: this.ids.size,
      nights: this.nights,
      occupiedNights: this.occupiedNights,
      availableNights,
    };
  }
}

export function emptyTotals(): Totals {
  return new Acc().totals(0);
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
  const buckets = periodBuckets(input.period);
  const occupancyBuckets = buckets;

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
  const accs = new Map<string, Acc>();
  const acc = (k: string) => accs.get(k) ?? accs.set(k, new Acc()).get(k)!;
  const usedGroups = new Set<string>(input.biens.map((b) => b.id));

  let cancelledIncluded = 0;
  let cancelledExcluded = 0;

  for (const r of kept) {
    const group = groupOf(r.listingId);
    if (input.groupKey && group !== input.groupKey) continue;

    // Occupation (calendrier) : séjours confirmés uniquement, quel que soit le mode.
    if (CONFIRMED.has(r.status)) {
      for (const s of allocate(r, "sejour", occupancyBuckets)) {
        if (s.nights <= 0) continue;
        usedGroups.add(group);
        for (const k of [`${group}|${s.bucket}`, `${group}|*`, `*|${s.bucket}`, "*|*"]) acc(k).occupiedNights += s.nights;
      }
    }

    const shares = allocate(r, input.mode, buckets);
    if (!shares.length) continue; // hors période pour ce mode
    const included = isIncluded(r, input.cancellations);
    if (r.status === "cancelled") {
      if (included) cancelledIncluded++;
      else cancelledExcluded++;
    }
    if (!included) continue;

    for (const s of shares) {
      usedGroups.add(group);
      for (const k of [`${group}|${s.bucket}`, `${group}|*`, `*|${s.bucket}`, "*|*", `ch:${r.channel}`]) acc(k).add(s, r.id);
    }
  }

  const days = buckets.reduce((a, b) => a + b.days, 0);
  const groups = [...usedGroups].filter((g) => !input.groupKey || g === input.groupKey);
  const get = (k: string, available: number) => (accs.get(k) ?? new Acc()).totals(available);

  const order = new Map(input.biens.map((b, i) => [b.id, i]));
  const rows: ReportRow[] = groups
    .map((g) => ({
      key: g,
      name: groupNames.get(g) ?? g,
      totals: get(`${g}|*`, days),
      byMonth: Object.fromEntries(buckets.map((b) => [b.key, get(`${g}|${b.key}`, b.days)])),
    }))
    .sort((a, b) => (order.get(a.key) ?? 1e9) - (order.get(b.key) ?? 1e9) || a.name.localeCompare(b.name, "fr"));

  const byChannel = [...accs.keys()]
    .filter((k) => k.startsWith("ch:"))
    .map((k) => ({ channel: k.slice(3), totals: get(k, 0) }))
    .sort((a, b) => b.totals.gross - a.totals.gross);

  return {
    buckets,
    rows,
    total: get("*|*", days * groups.length),
    totalByMonth: Object.fromEntries(buckets.map((b) => [b.key, get(`*|${b.key}`, b.days * groups.length)])),
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
