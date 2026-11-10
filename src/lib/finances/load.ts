/** Chargement des données Finances depuis la base (côté serveur, aucun appel Hostaway). */
import { prisma } from "@/lib/db";
import type { FinanceFilters } from "./filters";
import { buildReport, periodMonths, type Report, type ReportBien } from "./report";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export type GroupOption = { key: string; name: string };

export async function loadGroups(): Promise<{ biens: ReportBien[]; listingNames: Record<number, string>; options: GroupOption[] }> {
  const [biens, orphans] = await Promise.all([
    prisma.bien.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { listings: { select: { id: true } } },
    }),
    prisma.hostawayListing.findMany({ where: { bienId: null }, select: { id: true, name: true, internalName: true } }),
  ]);
  const listingNames = Object.fromEntries(orphans.map((l) => [l.id, l.internalName || l.name]));
  return {
    biens: biens.map((b) => ({ id: b.id, name: b.name, listingIds: b.listings.map((l) => l.id) })),
    listingNames,
    options: [
      ...biens.map((b) => ({ key: b.id, name: b.name })),
      ...orphans.map((l) => ({ key: `listing:${l.id}`, name: `${l.internalName || l.name} (non regroupé)` })),
    ],
  };
}

export async function loadReport(f: FinanceFilters): Promise<Report> {
  const months = periodMonths(f.periode === "annee" ? { year: f.year } : { year: f.year, month: f.month });
  const start = new Date(`${months[0]}-01T00:00:00Z`);
  const last = new Date(`${months[months.length - 1]}-01T00:00:00Z`);
  const end = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1));

  const [{ biens, listingNames }, rows] = await Promise.all([
    loadGroups(),
    prisma.reservation.findMany({
      where: {
        status: { in: ["new", "modified", "cancelled"] },
        OR: [
          // séjours qui chevauchent la période (mode « séjours du mois » et occupation)
          { arrivalDate: { lt: end }, departureDate: { gt: start } },
          // arrivées de la période (séjours de 0 nuit compris)
          { arrivalDate: { gte: start, lt: end } },
          // réservations faites pendant la période
          { reservationDate: { gte: start, lt: end } },
        ],
      },
      select: {
        id: true,
        listingId: true,
        channel: true,
        channelReservationId: true,
        status: true,
        arrivalDate: true,
        departureDate: true,
        reservationDate: true,
        nights: true,
        revenueCents: true,
        commissionCents: true,
        paymentFeesCents: true,
        payoutCents: true,
        cityTaxCents: true,
        cleaningFeeCents: true,
      },
    }),
  ]);

  return buildReport({
    reservations: rows.map((r) => ({
      ...r,
      arrival: iso(r.arrivalDate),
      departure: iso(r.departureDate),
      reservationDate: r.reservationDate ? iso(r.reservationDate) : null,
    })),
    biens,
    listingNames,
    period: f.periode === "annee" ? { year: f.year } : { year: f.year, month: f.month },
    mode: f.mode,
    cancellations: f.annulations,
    groupKey: f.bien === "tous" ? undefined : f.bien,
  });
}

export async function loadSyncState() {
  return prisma.hostawayState.findUnique({
    where: { id: "default" },
    select: { lastSyncAt: true, lastSyncStatus: true, lastSyncMessage: true, lastFullSyncAt: true },
  });
}

/** Années proposées dans le sélecteur : de la première à la dernière réservation. */
export async function loadYears(currentYear: number): Promise<number[]> {
  const agg = await prisma.reservation.aggregate({ _min: { arrivalDate: true }, _max: { departureDate: true } });
  const from = Math.min(agg._min.arrivalDate?.getUTCFullYear() ?? currentYear, currentYear - 1);
  const to = Math.max(agg._max.departureDate?.getUTCFullYear() ?? currentYear, currentYear);
  return Array.from({ length: to - from + 1 }, (_, i) => to - i);
}
