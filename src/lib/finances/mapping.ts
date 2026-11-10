/**
 * Mapping Hostaway → colonnes financières (module pur, sans accès réseau ni base).
 * Champs vérifiés sur les vraies réservations : voir docs/finances-hostaway.md.
 */

type Obj = Record<string, unknown>;

export type FinanceAmounts = {
  revenueCents: number;
  commissionCents: number;
  paymentFeesCents: number;
  payoutCents: number;
  cityTaxCents: number;
  cleaningFeeCents: number;
  totalPriceCents: number;
};

/** Statuts comptés comme séjours confirmés. */
export const CONFIRMED_STATUSES = ["new", "modified"] as const;
export const CANCELLED_STATUS = "cancelled";

/** Le détail financier n'a d'intérêt que pour les séjours (pas les demandes, refus, expirées…). */
export function needsFinanceDetail(r: Obj): boolean {
  const status = String(r.status ?? "");
  if ((CONFIRMED_STATUSES as readonly string[]).includes(status)) return true;
  return status === CANCELLED_STATUS && Math.abs(num(r.totalPrice)) >= 0.005;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const cents = (v: number) => Math.round(v * 100);
const firstNonZero = (...values: unknown[]) => values.map(num).find((v) => v !== 0) ?? 0;

/** Taxes de séjour possibles dans /financeStandardField (Paris : cityTax pour Booking, TOT pour Airbnb). */
const CITY_TAX_FIELDS = [
  "cityTax",
  "airbnbTransientOccupancyTax",
  "transientOccupancyTax",
  "guestNightlyTax",
  "guestStayTax",
  "guestPerPersonPerNightTax",
] as const;

/** Frais de traitement du paiement supportés par l'hôte. */
const PAYMENT_FEE_FIELDS = ["paymentServiceProcessingFees", "bookingcomPaymentProcessingFee"] as const;

/**
 * @param r   réservation Hostaway (GET /reservations)
 * @param fin détail financier (GET /financeStandardField/reservation/{id}), ou null s'il n'a pas été lu
 */
export function mapFinance(r: Obj, fin: Obj | null): FinanceAmounts {
  const totalPrice = num(r.totalPrice);
  const status = String(r.status ?? "");
  const isAirbnb = String(r.channelName ?? "").startsWith("airbnb");

  // Annulation sans montant conservé : rien n'a été encaissé (Hostaway garde pourtant
  // baseRate / taxes de la réservation initiale dans le détail financier).
  if (status === CANCELLED_STATUS && Math.abs(totalPrice) < 0.005) return zero();

  const f = fin ?? {};
  let cityTax = CITY_TAX_FIELDS.reduce((a, k) => a + num(f[k]), 0);
  // Airbnb : salesTax reprend la même taxe de séjour que airbnbTransientOccupancyTax.
  if (isAirbnb && num(f.airbnbTransientOccupancyTax) === 0) cityTax += num(f.salesTax);
  // Sans détail financier : champ Airbnb de la réservation.
  if (!fin && isAirbnb) cityTax = num(r.airbnbTransientOccupancyTaxPaidAmount);

  // Commission hôte + frais de service voyageur (guestChannelFee) : inclus dans totalPrice
  // mais conservés par la plateforme (vérifié : versement = airbnbPayoutSum).
  const commission =
    firstNonZero(f.hostChannelFee, r.channelCommissionAmount, isAirbnb ? r.airbnbListingHostFee : 0) + num(f.guestChannelFee);
  const paymentFees = PAYMENT_FEE_FIELDS.reduce((a, k) => a + num(f[k]), 0);
  const cleaning = firstNonZero(f.cleaningFeeValue, r.cleaningFee, r.airbnbListingCleaningFee);

  // Résolutions Airbnb : Hostaway les retire de totalPrice, mais ni son rapport « Activité de
  // location » ni le versement Airbnb (airbnbPayoutSum) ne les déduisent pour un séjour confirmé
  // (vérifié au centime : 1er-10/11/2026). Pour une annulation, la résolution EST le montant
  // conservé : on la garde.
  const resolutions = (CONFIRMED_STATUSES as readonly string[]).includes(status)
    ? num(f.airbnbClosedResolutionsSum) + num(f.airbnbOpenResolutionsSum)
    : 0;

  const totalPriceCents = cents(totalPrice);
  const cityTaxCents = cents(cityTax);
  const revenueCents = totalPriceCents - cents(resolutions) - cityTaxCents;
  const commissionCents = cents(commission);
  const paymentFeesCents = cents(paymentFees);

  return {
    revenueCents,
    commissionCents,
    paymentFeesCents,
    payoutCents: revenueCents - commissionCents - paymentFeesCents,
    cityTaxCents,
    cleaningFeeCents: cents(cleaning),
    totalPriceCents,
  };
}

function zero(): FinanceAmounts {
  return {
    revenueCents: 0,
    commissionCents: 0,
    paymentFeesCents: 0,
    payoutCents: 0,
    cityTaxCents: 0,
    cleaningFeeCents: 0,
    totalPriceCents: 0,
  };
}

/* ----------------------- Données conservées (sans PII) ----------------------- */

const SAFE_STRINGS = new Set([
  "channelName",
  "status",
  "currency",
  "arrivalDate",
  "departureDate",
  "reservationDate",
  "insertedOn",
  "updatedOn",
  "latestActivityOn",
  "cancellationDate",
  "paymentStatus",
  "source",
  "channelReservationId",
  "hostawayReservationId",
  "externalPropertyId",
  "externalUnitId",
]);
const UNSAFE_NUMERIC = /phone|zip|^cc|cvc|door|customerUser|braintree|stripe|guestExternal/i;

/** Ne garde que les champs non personnels de la réservation (montants, dates, statuts, compteurs). */
export function sanitizeReservation(r: Obj): Obj {
  const out: Obj = {};
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === "number" || typeof v === "boolean") {
      if (!UNSAFE_NUMERIC.test(k)) out[k] = v;
    } else if (typeof v === "string" && SAFE_STRINGS.has(k)) {
      out[k] = v;
    }
  }
  return out;
}

/** Détail financier : uniquement les valeurs numériques non nulles. */
export function compactFinance(f: Obj | null): Obj | null {
  if (!f) return null;
  const out: Obj = {};
  for (const [k, v] of Object.entries(f)) if (typeof v === "number" && v !== 0 && !/Id$|^id$/.test(k)) out[k] = v;
  return out;
}
