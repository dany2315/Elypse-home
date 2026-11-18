/** Chargement des données Finances depuis la base (côté serveur, aucun appel Hostaway). */
import { prisma } from "@/lib/db";
import { toPeriod, type FinanceFilters } from "./filters";
import type { ReportCharge } from "./charges";
import { buildReport, periodRange, type Report, type ReportBien } from "./report";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export type GroupOption = { key: string; name: string };

export async function loadGroups(): Promise<{
  biens: ReportBien[];
  listingNames: Record<number, string>;
  options: GroupOption[];
  /** Livret d'accueil relié à chaque bien (clé de groupe → id du livret). */
  livretOf: Record<string, string>;
  /** Biens retirés des calculs. */
  excluded: string[];
}> {
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
    livretOf: Object.fromEntries(biens.filter((b) => b.livretId).map((b) => [b.id, b.livretId!])),
    excluded: biens.filter((b) => b.excludedFromReports).map((b) => b.id),
    options: [
      ...biens.map((b) => ({ key: b.id, name: b.excludedFromReports ? `${b.name} (exclu des calculs)` : b.name })),
      ...orphans.map((l) => ({ key: `listing:${l.id}`, name: `${l.internalName || l.name} (non regroupé)` })),
    ],
  };
}

/** Charges fixes de tous les biens, avec leurs versions. */
export async function loadCharges(): Promise<ReportCharge[]> {
  const charges = await prisma.bienCharge.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { versions: true },
  });
  return charges.map((c) => ({
    id: c.id,
    bienId: c.bienId,
    category: c.category,
    label: c.label,
    versions: c.versions.map((v) => ({
      id: v.id,
      start: iso(v.startDate),
      end: v.endDate ? iso(v.endDate) : null,
      amountCents: v.amountCents,
      vatRateBp: v.vatRateBp,
      createdAt: v.createdAt.toISOString(),
      note: v.note,
    })),
  }));
}

/**
 * Rapport de la période. `includeExcluded` : compter aussi les biens retirés des calculs
 * (chiffres d'un livret, qui concernent son propre bien).
 */
export async function loadReport(f: FinanceFilters, opts: { includeExcluded?: boolean } = {}): Promise<Report> {
  const period = toPeriod(f);
  const range = periodRange(period);
  const start = new Date(`${range.start}T00:00:00Z`);
  const end = new Date(`${range.end}T00:00:00Z`);

  const [{ biens, listingNames, excluded }, charges, rows] = await Promise.all([
    loadGroups(),
    loadCharges(),
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
        guestName: true,
        status: true,
        arrivalDate: true,
        departureDate: true,
        reservationDate: true,
        nights: true,
        revenueCents: true,
        commissionCents: true,
        paymentFeesCents: true,
        refundsCents: true,
        payoutCents: true,
        cityTaxCents: true,
        vatCents: true,
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
    charges,
    excluded: opts.includeExcluded ? [] : excluded,
    period,
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

/**
 * Chiffres du mois en cours pour chaque livret relié à un ou plusieurs biens (nuits passées dans
 * le mois, annulations seulement si elles rapportent, charges déduites, biens exclus compris).
 * Clé : id du livret.
 */
export async function loadLivretMonth(today: string): Promise<{
  month: string;
  byLivret: Record<string, { bienKeys: string[]; gross: number; profit: number; occupied: number; available: number }>;
}> {
  const [year, month] = today.split("-").map(Number);
  const [{ livretOf }, report] = await Promise.all([
    loadGroups(),
    loadReport(
      { periode: "mois", year, month, from: "", to: "", bien: "tous", mode: "sejour", annulations: "versement", vue: "biens" },
      { includeExcluded: true },
    ),
  ]);
  const byLivret: Record<string, { bienKeys: string[]; gross: number; profit: number; occupied: number; available: number }> = {};
  for (const row of report.rows) {
    const livretId = livretOf[row.key];
    if (!livretId) continue;
    const t = (byLivret[livretId] ??= { bienKeys: [], gross: 0, profit: 0, occupied: 0, available: 0 });
    t.bienKeys.push(row.key);
    t.gross += row.totals.gross;
    t.profit += row.totals.profit;
    t.occupied += row.totals.occupiedNights;
    t.available += row.totals.availableNights;
  }
  return { month: `${year}-${String(month).padStart(2, "0")}`, byLivret };
}
