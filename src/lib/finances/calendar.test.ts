import assert from "node:assert/strict";
import { test } from "node:test";
import { dayActivity, laneAt, monthStats, monthWeeks, type CalendarStay } from "./calendar";

const stay = (id: number, unit: string, arrival: string, departure: string): CalendarStay => ({
  id,
  unit,
  unitName: unit,
  channel: "airbnbOfficial",
  guestName: null,
  reference: null,
  arrival,
  departure,
  nights: Math.round((Date.parse(departure) - Date.parse(arrival)) / 86_400_000),
  gross: 0,
  payout: 0,
});

test("semaines du mois : du lundi au dimanche, cases voisines comprises", () => {
  const weeks = monthWeeks("2026-11"); // 1er novembre 2026 = dimanche
  assert.equal(weeks.length, 6);
  assert.equal(weeks[0][0].date, "2026-10-26");
  assert.equal(weeks[0][6].date, "2026-11-01");
  assert.equal(weeks[0][0].inMonth, false);
  assert.equal(weeks[5][0].date, "2026-11-30");
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(weeks[1][5].weekend, true);
});

test("activité d'un jour : arrivées, séjours en cours, départs, logements occupés le soir", () => {
  const stays = [stay(1, "a", "2026-11-20", "2026-11-23"), stay(2, "a", "2026-11-23", "2026-11-25"), stay(3, "b", "2026-11-21", "2026-11-26")];
  const d = dayActivity(stays, "2026-11-23");
  assert.deepEqual(d.arrivals.map((s) => s.id), [2]);
  assert.deepEqual(d.staying.map((s) => s.id), [3]);
  assert.deepEqual(d.departures.map((s) => s.id), [1]);
  assert.equal(d.occupied, 2);
});

test("ligne d'un bien : nuit précédente et nuit du jour (jour de rotation)", () => {
  const stays = [stay(1, "a", "2026-11-20", "2026-11-23"), stay(2, "a", "2026-11-23", "2026-11-25")];
  assert.deepEqual([laneAt(stays, "2026-11-23").previous?.id, laneAt(stays, "2026-11-23").current?.id], [1, 2]);
  assert.deepEqual([laneAt(stays, "2026-11-24").previous?.id, laneAt(stays, "2026-11-24").current?.id], [2, 2]);
  assert.equal(laneAt(stays, "2026-11-25").current, null);
});

test("occupation du mois : nuits coupées aux bornes du mois", () => {
  const s = monthStats({
    month: "2026-11",
    units: [{ key: "a", name: "A" }, { key: "b", name: "B" }],
    legend: [{ key: "a", name: "A" }, { key: "b", name: "B" }],
    stays: [stay(1, "a", "2026-10-29", "2026-11-03"), stay(2, "b", "2026-11-28", "2026-12-04")],
  });
  assert.equal(s.nights, 2 + 3);
  assert.equal(s.available, 60);
  assert.equal(s.arrivals, 1);
});
