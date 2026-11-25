// pnpm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chargeForMonth, chargeInRange, chargeSegments, htFromTtc, parseEuros, segmentAt, ttcOf, type ChargeVersion } from "./charges";
import { buildReport, type ReportReservation } from "./report";

const v = (o: Partial<ChargeVersion> & { id: string; start: string }): ChargeVersion => ({
  end: null,
  amountCents: 100_000,
  vatRateBp: 2000,
  createdAt: "2026-01-01T10:00:00.000Z",
  ...o,
});

describe("chargeSegments — historique des versions", () => {
  it("une modification « à partir du » ne change pas les mois précédents", () => {
    const segs = chargeSegments([
      v({ id: "a", start: "2025-01-01", amountCents: 120_000 }),
      v({ id: "b", start: "2026-03-01", amountCents: 125_000, createdAt: "2026-02-10T09:00:00.000Z" }),
    ]);
    assert.deepEqual(
      segs.map((s) => [s.versionId, s.start, s.end, s.amountCents]),
      [
        ["a", "2025-01-01", "2026-02-28", 120_000],
        ["b", "2026-03-01", null, 125_000],
      ],
    );
  });

  it("une modification bornée (du … au …) laisse reprendre l'ancien montant après", () => {
    const segs = chargeSegments([
      v({ id: "a", start: "2026-01-01" }),
      v({ id: "b", start: "2026-06-01", end: "2026-08-31", amountCents: 0, createdAt: "2026-05-01T00:00:00.000Z" }),
    ]);
    assert.deepEqual(
      segs.map((s) => [s.versionId, s.start, s.end]),
      [
        ["a", "2026-01-01", "2026-05-31"],
        ["b", "2026-06-01", "2026-08-31"],
        ["a", "2026-09-01", null],
      ],
    );
    assert.equal(segmentAt(segs, "2026-07-14")?.amountCents, 0);
    assert.equal(segmentAt(segs, "2026-09-01")?.versionId, "a");
  });

  it("sur un même jour, la saisie la plus récente l'emporte, même si elle commence avant", () => {
    const segs = chargeSegments([
      v({ id: "a", start: "2026-03-01", amountCents: 1 }),
      v({ id: "b", start: "2026-01-01", amountCents: 2, createdAt: "2026-04-01T00:00:00.000Z" }),
    ]);
    assert.deepEqual(segs.map((s) => [s.versionId, s.start, s.end]), [["b", "2026-01-01", null]]);
  });

  it("pas de charge avant la première date", () => {
    const segs = chargeSegments([v({ id: "a", start: "2026-05-15", end: "2026-05-31" })]);
    assert.equal(segmentAt(segs, "2026-05-14"), null);
    assert.equal(segmentAt(segs, "2026-06-01"), null);
  });
});

describe("chargeInRange — répartition au jour", () => {
  const segs = chargeSegments([v({ id: "a", start: "2026-01-01", amountCents: 150_000, vatRateBp: 2000 })]);

  it("un mois entier compte le montant exact, TVA à part", () => {
    assert.deepEqual(chargeForMonth(segs, "2026-11"), { ht: 150_000, vat: 30_000, ttc: 180_000 });
    assert.deepEqual(chargeForMonth(segs, "2026-02"), { ht: 150_000, vat: 30_000, ttc: 180_000 });
  });

  it("une partie de mois compte au prorata des jours", () => {
    // 1er au 16 novembre : 16/30.
    assert.deepEqual(chargeInRange(segs, "2026-11-01", "2026-11-17"), { ht: 80_000, vat: 16_000 });
  });

  it("un changement en cours de mois est compté au jour", () => {
    const s2 = chargeSegments([
      v({ id: "a", start: "2026-01-01", amountCents: 30_000, vatRateBp: 0 }),
      v({ id: "b", start: "2026-11-16", amountCents: 60_000, vatRateBp: 0, createdAt: "2026-11-10T00:00:00.000Z" }),
    ]);
    // 15 jours à 300 € + 15 jours à 600 € sur un mois de 30 jours.
    assert.deepEqual(chargeForMonth(s2, "2026-11"), { ht: 45_000, vat: 0, ttc: 45_000 });
  });
});

describe("montants saisis", () => {
  it("lit les montants à la française", () => {
    assert.equal(parseEuros("1 250,50"), 125_050);
    assert.equal(parseEuros("1250.5 €"), 125_050);
    assert.equal(parseEuros("12,345"), null);
    assert.equal(parseEuros("-3"), null);
  });

  it("passe du TTC au HT et inversement", () => {
    assert.equal(ttcOf(100_000, 2000), 120_000);
    assert.equal(htFromTtc(120_000, 2000), 100_000);
    assert.equal(htFromTtc(10_550, 550), 10_000);
  });
});

describe("buildReport — charges et biens exclus", () => {
  const resa: ReportReservation = {
    id: 1,
    listingId: 1,
    channel: "airbnbOfficial",
    status: "new",
    arrival: "2026-11-05",
    departure: "2026-11-07",
    reservationDate: "2026-10-01",
    nights: 2,
    revenueCents: 50_000,
    commissionCents: 5_000,
    paymentFeesCents: 0,
    payoutCents: 45_000,
    cityTaxCents: 1_000,
    cleaningFeeCents: 0,
  };
  const biens = [
    { id: "b1", name: "Miromesnil", listingIds: [1] },
    { id: "b2", name: "Vaneau", listingIds: [2] },
  ];
  const charges = [
    { id: "c1", bienId: "b1", category: "loyer", label: "Loyer", versions: [v({ id: "x", start: "2026-01-01", amountCents: 100_000, vatRateBp: 0 })] },
    { id: "c2", bienId: "b1", category: "electricite", label: "Électricité", versions: [v({ id: "y", start: "2026-01-01", amountCents: 5_000, vatRateBp: 2000 })] },
    { id: "c3", bienId: "b2", category: "loyer", label: "Loyer", versions: [v({ id: "z", start: "2026-01-01", amountCents: 80_000, vatRateBp: 0 })] },
  ];
  const base = { reservations: [resa, { ...resa, id: 2, listingId: 2 }], biens, charges, mode: "sejour" as const, cancellations: "versement" as const };

  it("déduit les charges TTC du bénéfice, par bien et au total", () => {
    const r = buildReport({ ...base, period: { year: 2026, month: 11 } });
    const b1 = r.rows.find((x) => x.key === "b1")!.totals;
    assert.equal(b1.chargesHT, 105_000);
    assert.equal(b1.chargesVat, 1_000);
    assert.equal(b1.charges, 106_000);
    assert.equal(b1.payout, 45_000);
    assert.equal(b1.profit, 45_000 - 106_000);
    assert.equal(r.total.charges, 106_000 + 80_000);
    assert.equal(r.total.profit, 90_000 - 186_000);
    assert.equal(r.totalByMonth["2026-11"].charges, r.total.charges);
    assert.equal(r.charges.length, 3);
    // Les plateformes ne portent pas de charges.
    assert.equal(r.byChannel[0].totals.charges, 0);
  });

  it("une année = somme de ses mois", () => {
    const year = buildReport({ ...base, period: { year: 2026 } });
    const months = Object.values(year.totalByMonth).reduce((a, t) => a + t.charges, 0);
    assert.equal(year.total.charges, months);
    assert.equal(year.total.chargesHT, 12 * 185_000);
  });

  it("un bien exclu disparaît des totaux, sauf s'il est choisi seul", () => {
    const r = buildReport({ ...base, period: { year: 2026, month: 11 }, excluded: ["b2"] });
    assert.deepEqual(r.rows.map((x) => x.key), ["b1"]);
    assert.equal(r.total.payout, 45_000);
    assert.equal(r.total.charges, 106_000);
    assert.equal(r.total.availableNights, 30);
    assert.deepEqual(r.excluded, [{ key: "b2", name: "Vaneau" }]);

    const alone = buildReport({ ...base, period: { year: 2026, month: 11 }, excluded: ["b2"], groupKey: "b2" });
    assert.equal(alone.total.payout, 45_000);
    assert.equal(alone.total.charges, 80_000);
  });
});

describe("buildReport — charges par séjour (ménage)", () => {
  const stay = (o: Partial<ReportReservation> & { id: number; arrival: string; departure: string }): ReportReservation => ({
    listingId: 1,
    channel: "airbnbOfficial",
    status: "new",
    reservationDate: "2026-09-15",
    nights: 2,
    revenueCents: 40_000,
    commissionCents: 4_000,
    paymentFeesCents: 0,
    payoutCents: 36_000,
    cityTaxCents: 0,
    cleaningFeeCents: 0,
    ...o,
  });
  const biens = [{ id: "b1", name: "Vaneau", listingIds: [1] }];
  const menage = {
    id: "m",
    bienId: "b1",
    category: "menage",
    label: "Ménage",
    per: "sejour" as const,
    versions: [
      v({ id: "m1", start: "2026-01-01", amountCents: 5_600, vatRateBp: 0 }),
      v({ id: "m2", start: "2026-11-01", amountCents: 6_000, vatRateBp: 0, createdAt: "2026-10-20T10:00:00.000Z" }),
    ],
  };
  const reservations = [
    stay({ id: 1, arrival: "2026-10-30", departure: "2026-11-02", nights: 3 }), // à cheval : ménage en octobre
    stay({ id: 2, arrival: "2026-11-05", departure: "2026-11-07" }),
    stay({ id: 3, arrival: "2026-11-10", departure: "2026-11-12", status: "cancelled", payoutCents: 10_000 }),
  ];
  const base = { reservations, biens, charges: [menage], mode: "sejour" as const, cancellations: "toutes" as const };

  it("compte le tarif du jour d'arrivée, une fois par séjour confirmé, au mois d'arrivée", () => {
    const nov = buildReport({ ...base, period: { year: 2026, month: 11 } });
    assert.equal(nov.total.charges, 6_000); // séjour 2 seulement (le 1 est arrivé en octobre, le 3 est annulé)
    assert.deepEqual(nov.charges.map((c) => [c.label, c.ht, c.stays]), [["Ménage", 6_000, 1]]);
    const oct = buildReport({ ...base, period: { year: 2026, month: 10 } });
    assert.equal(oct.total.charges, 5_600);
    const both = buildReport({ ...base, period: { from: "2026-10-01", to: "2026-11-30" } });
    assert.equal(both.total.charges, 11_600);
    assert.equal(both.charges[0].stays, 2);
  });

  it("déduit le ménage du bénéfice de la réservation", () => {
    const r = buildReport({ ...base, period: { year: 2026, month: 11 } });
    const line = r.reservations.find((l) => l.id === 2)!;
    assert.equal(line.totals.charges, 6_000);
    assert.equal(line.totals.profit, 36_000 - 6_000);
    assert.equal(r.reservations.find((l) => l.id === 3)!.totals.charges, 0);
  });

  it("n'est pas réparti au jour comme une charge mensuelle", () => {
    const r = buildReport({ ...base, reservations: [], period: { year: 2026, month: 11 } });
    assert.equal(r.total.charges, 0);
    assert.equal(r.charges.length, 0);
  });

  it("mode réservation : compté au mois de la réservation", () => {
    const r = buildReport({ ...base, mode: "reservation", period: { year: 2026, month: 9 } });
    assert.equal(r.total.charges, 5_600 + 6_000);
  });
});
