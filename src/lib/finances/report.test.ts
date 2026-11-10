// pnpm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapFinance } from "./mapping";
import { allocate, buildReport, dedupe, nightsByMonth, type ReportReservation } from "./report";

const resa = (o: Partial<ReportReservation> & { id: number }): ReportReservation => ({
  listingId: 1,
  channel: "airbnbOfficial",
  channelReservationId: null,
  status: "new",
  arrival: "2026-10-10",
  departure: "2026-10-12",
  reservationDate: "2026-09-01",
  nights: 2,
  revenueCents: 0,
  commissionCents: 0,
  paymentFeesCents: 0,
  payoutCents: 0,
  cityTaxCents: 0,
  cleaningFeeCents: 0,
  ...o,
});

// Séjour à cheval : 30 oct → 2 nov (3 nuits : 30, 31 oct, 1er nov).
const cheval = resa({
  id: 10,
  arrival: "2026-10-30",
  departure: "2026-11-02",
  reservationDate: "2026-09-15",
  nights: 3,
  revenueCents: 30000, // dont 60 € de ménage
  cleaningFeeCents: 6000,
  commissionCents: 3000,
  paymentFeesCents: 300,
  payoutCents: 26700,
  cityTaxCents: 1500,
});

const biens = [{ id: "b1", name: "Miromesnil", listingIds: [1, 2] }];

describe("nightsByMonth", () => {
  it("compte les nuits de chaque mois (départ exclu)", () => {
    assert.deepEqual([...nightsByMonth("2026-10-30", "2026-11-02")], [["2026-10", 2], ["2026-11", 1]]);
    assert.deepEqual([...nightsByMonth("2026-12-31", "2027-01-01")], [["2026-12", 1]]);
  });
});

describe("allocate — séjours du mois", () => {
  it("répartit au prorata des nuits et met le ménage au mois d'arrivée", () => {
    const [oct, nov] = allocate(cheval, "sejour");
    // (300 − 60) € à la nuit = 80 €/nuit → oct : 2 × 80 + 60 ; nov : 80.
    assert.equal(oct.revenue, 22000);
    assert.equal(nov.revenue, 8000);
    assert.equal(oct.cleaning, 6000);
    assert.equal(nov.cleaning, 0);
    assert.equal(oct.commission, 2000);
    assert.equal(nov.commission, 1000);
    assert.equal(oct.nights, 2);
    assert.equal(nov.nights, 1);
  });

  it("garde des sommes exactes à l'arrondi", () => {
    const r = resa({ id: 11, arrival: "2026-10-31", departure: "2026-12-02", nights: 32, revenueCents: 10001, commissionCents: 333 });
    const shares = allocate(r, "sejour");
    assert.equal(shares.reduce((a, s) => a + s.revenue, 0), 10001);
    assert.equal(shares.reduce((a, s) => a + s.commission, 0), 333);
    assert.equal(shares.reduce((a, s) => a + s.nights, 0), 32);
  });
});

describe("buildReport", () => {
  it("séjour à cheval : octobre et novembre, total annuel = réservation", () => {
    const base = { reservations: [cheval], biens, mode: "sejour" as const, cancellations: "versement" as const };
    const oct = buildReport({ ...base, period: { year: 2026, month: 10 } });
    const nov = buildReport({ ...base, period: { year: 2026, month: 11 } });
    assert.equal(oct.total.revenue, 22000);
    assert.equal(nov.total.revenue, 8000);
    assert.equal(oct.total.payout + nov.total.payout, 26700);
    assert.equal(oct.total.stays, 1);
    assert.equal(nov.total.stays, 1);

    const year = buildReport({ ...base, period: { year: 2026 } });
    assert.equal(year.total.revenue, 30000);
    assert.equal(year.total.payout, 26700);
    assert.equal(year.total.cityTax, 1500);
    assert.equal(year.total.stays, 1, "un séjour sur deux mois n'est compté qu'une fois sur l'année");
    assert.equal(year.totalByMonth["2026-10"].revenue, 22000);
    assert.equal(year.totalByMonth["2026-11"].revenue, 8000);
  });

  it("arrivées du mois et réservations faites dans le mois", () => {
    const base = { reservations: [cheval], biens, cancellations: "versement" as const };
    assert.equal(buildReport({ ...base, mode: "arrivee", period: { year: 2026, month: 10 } }).total.revenue, 30000);
    assert.equal(buildReport({ ...base, mode: "arrivee", period: { year: 2026, month: 11 } }).total.revenue, 0);
    assert.equal(buildReport({ ...base, mode: "reservation", period: { year: 2026, month: 9 } }).total.revenue, 30000);
    // L'occupation reste calendaire : 2 nuits en octobre, même en mode « réservations ».
    assert.equal(buildReport({ ...base, mode: "reservation", period: { year: 2026, month: 10 } }).total.occupiedNights, 2);
  });

  it("deux listings dans un même bien : une seule ligne, sans double comptage", () => {
    const r1 = resa({ id: 1, listingId: 1, revenueCents: 20000, payoutCents: 17000, commissionCents: 3000 });
    const r2 = resa({ id: 2, listingId: 2, channel: "bookingcom", channelReservationId: "BK1", arrival: "2026-10-20", departure: "2026-10-23", nights: 3, revenueCents: 45000, payoutCents: 38000, commissionCents: 7000 });
    // Même réservation Booking remontée deux fois (ex. listing dupliqué) : comptée une fois.
    const r2bis = { ...r2, id: 3, listingId: 1 };
    const report = buildReport({ reservations: [r1, r2, r2bis], biens, mode: "arrivee", cancellations: "versement", period: { year: 2026, month: 10 } });
    assert.equal(report.rows.length, 1);
    assert.equal(report.rows[0].name, "Miromesnil");
    assert.equal(report.rows[0].totals.revenue, 65000);
    assert.equal(report.rows[0].totals.stays, 2);
    assert.equal(report.rows[0].totals.nights, 5);
    assert.equal(report.duplicates, 1);
    assert.equal(report.total.revenue, 65000);
    assert.deepEqual(report.byChannel.map((c) => [c.channel, c.totals.revenue]), [["bookingcom", 45000], ["airbnbOfficial", 20000]]);
    // Occupation : 5 nuits sur 31 nuits disponibles (un seul bien, même avec deux listings).
    assert.equal(report.total.occupiedNights, 5);
    assert.equal(report.total.availableNights, 31);
  });

  it("annulations : exclues sauf versement conservé, filtre inclure / exclure", () => {
    const keep = resa({ id: 20, status: "cancelled", revenueCents: 10000, payoutCents: 8500, commissionCents: 1500 });
    const none = resa({ id: 21, status: "cancelled" });
    const inquiry = resa({ id: 22, status: "inquiry", revenueCents: 99900, payoutCents: 99900 });
    const base = { reservations: [keep, none, inquiry], biens, mode: "arrivee" as const, period: { year: 2026, month: 10 } };
    const def = buildReport({ ...base, cancellations: "versement" });
    assert.equal(def.total.payout, 8500);
    assert.equal(def.total.stays, 1);
    assert.equal(def.cancelledExcluded, 1);
    assert.equal(buildReport({ ...base, cancellations: "toutes" }).total.stays, 2);
    assert.equal(buildReport({ ...base, cancellations: "aucune" }).total.stays, 0);
  });

  it("listing non rattaché : ligne à son nom", () => {
    const r = resa({ id: 30, listingId: 9, revenueCents: 100 });
    const report = buildReport({ reservations: [r], biens, listingNames: { 9: "Studio" }, mode: "arrivee", cancellations: "versement", period: { year: 2026, month: 10 } });
    assert.ok(report.rows.some((row) => row.key === "listing:9" && row.name === "Studio" && row.totals.revenue === 100));
  });
});

describe("dedupe", () => {
  it("préfère la version confirmée", () => {
    const a = resa({ id: 1, channelReservationId: "X", status: "cancelled" });
    const b = resa({ id: 2, channelReservationId: "X", status: "new" });
    assert.deepEqual(dedupe([b, a]).kept.map((r) => r.id), [2]);
  });
});

describe("mapFinance (champs Hostaway réels)", () => {
  it("Airbnb : taxe de séjour hors revenus, frais voyageur en commission, versement = payout Airbnb", () => {
    const m = mapFinance(
      { channelName: "airbnbOfficial", status: "new", totalPrice: 657.98 },
      { hostChannelFee: 87.73, baseRate: 566, salesTax: 91.98, airbnbTransientOccupancyTax: 91.98, airbnbPayoutSum: 478.27 },
    );
    assert.equal(m.cityTaxCents, 9198);
    assert.equal(m.revenueCents, 56600);
    assert.equal(m.payoutCents, 47827);
    const g = mapFinance(
      { channelName: "airbnbOfficial", status: "new", totalPrice: 1100 },
      { hostChannelFee: 100, guestChannelFee: 150, airbnbTransientOccupancyTax: 50 },
    );
    assert.equal(g.revenueCents, 105000);
    assert.equal(g.commissionCents, 25000);
    assert.equal(g.payoutCents, 80000);
  });

  it("Booking : cityTax séparée, TVA conservée dans les revenus", () => {
    const m = mapFinance(
      { channelName: "bookingcom", status: "new", totalPrice: 534.71, channelCommissionAmount: 80.94 },
      { hostChannelFee: 80.94, baseRate: 432.82, vat: 43.28, cityTax: 58.61 },
    );
    assert.equal(m.cityTaxCents, 5861);
    assert.equal(m.revenueCents, 47610);
    assert.equal(m.commissionCents, 8094);
    assert.equal(m.payoutCents, 39516);
  });

  it("annulation sans montant conservé : tout à zéro", () => {
    const m = mapFinance({ channelName: "bookingcom", status: "cancelled", totalPrice: 0 }, { baseRate: 707, cityTax: 114.89, hostChannelFee: 100 });
    assert.equal(m.payoutCents, 0);
    assert.equal(m.cityTaxCents, 0);
  });

  it("ménage : montant réellement facturé, 0 sinon", () => {
    assert.equal(mapFinance({ channelName: "airbnbOfficial", status: "new", totalPrice: 500 }, { cleaningFeeValue: 200 }).cleaningFeeCents, 20000);
    assert.equal(mapFinance({ channelName: "airbnbOfficial", status: "new", totalPrice: 500 }, {}).cleaningFeeCents, 0);
  });
});
