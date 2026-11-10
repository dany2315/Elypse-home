/**
 * Synchronisation Hostaway → base (idempotente : upsert). LECTURE SEULE côté Hostaway.
 *
 * - Listings : upsert ; ceux qui ne sont plus renvoyés passent en inactif.
 * - Réservations : la liste complète est relue (≈ 750 lignes, quelques secondes) ;
 *   le détail financier (/financeStandardField, 1 appel par réservation) n'est
 *   redemandé que pour les séjours nouveaux ou modifiés (updatedOn), ou tous en mode `full`.
 * - Un bien est créé automatiquement pour chaque listing qui n'en a pas.
 * - Budget de temps : au-delà, les réservations restantes sont reprises à la synchro suivante.
 */
import { prisma } from "@/lib/db";
import { createHostawayClient, type HostawayReservation, type TokenStore } from "@/lib/hostaway";
import { compactFinance, mapFinance, needsFinanceDetail, sanitizeReservation } from "@/lib/finances/mapping";
import type { Prisma } from "@/generated/prisma/client";

const STATE_ID = "default";
const LOCK_MS = 15 * 60 * 1000;
const CONCURRENCY = 3;

export const dbTokenStore: TokenStore = {
  async get() {
    const s = await prisma.hostawayState.findUnique({ where: { id: STATE_ID }, select: { accessToken: true } });
    return s?.accessToken ?? null;
  },
  async set(token, expiresAt) {
    await prisma.hostawayState.upsert({
      where: { id: STATE_ID },
      create: { id: STATE_ID, accessToken: token, tokenExpiresAt: expiresAt },
      update: { accessToken: token, tokenExpiresAt: expiresAt },
    });
  },
  async clear() {
    await prisma.hostawayState.updateMany({ where: { id: STATE_ID }, data: { accessToken: null, tokenExpiresAt: null } });
  },
};

export type SyncOptions = {
  /** Relit le détail financier de toutes les réservations. */
  full?: boolean;
  /** Durée maximale (ms) consacrée aux détails financiers. */
  budgetMs?: number;
  /** Ignore un verrou en cours (scripts). */
  force?: boolean;
  log?: (msg: string) => void;
};

export type SyncResult = {
  status: "ok" | "partial" | "error" | "locked";
  message: string;
  listings: number;
  reservations: number;
  financeFetched: number;
  financeRemaining: number;
  biensCreated: number;
  durationMs: number;
};

const toDate = (s: unknown): Date | null => {
  const m = typeof s === "string" ? s.match(/^(\d{4}-\d{2}-\d{2})/) : null;
  return m ? new Date(`${m[1]}T00:00:00.000Z`) : null;
};
const DAY = 86_400_000;

export async function syncHostaway(opts: SyncOptions = {}): Promise<SyncResult> {
  const started = Date.now();
  const log = opts.log ?? (() => {});
  const budgetMs = opts.budgetMs ?? Number.POSITIVE_INFINITY;

  if (!(await acquireLock(opts.force))) {
    return { status: "locked", message: "Une synchronisation est déjà en cours.", listings: 0, reservations: 0, financeFetched: 0, financeRemaining: 0, biensCreated: 0, durationMs: 0 };
  }

  try {
    const client = createHostawayClient({ store: dbTokenStore });

    /* ------------------------------- Listings ------------------------------ */
    const listings = await client.listListings();
    log(`${listings.length} listings`);
    for (const l of listings) {
      const data = {
        name: String(l.name ?? l.externalListingName ?? ""),
        internalName: String(l.internalListingName ?? ""),
        active: true,
      };
      await prisma.hostawayListing.upsert({ where: { id: l.id }, create: { id: l.id, ...data }, update: data });
    }
    await prisma.hostawayListing.updateMany({
      where: { id: { notIn: listings.map((l) => l.id) } },
      data: { active: false },
    });

    /* ----------------------------- Réservations ---------------------------- */
    const reservations = (await client.listReservations()).filter(
      (r) => toDate(r.arrivalDate) && toDate(r.departureDate) && typeof r.listingMapId === "number",
    );
    log(`${reservations.length} réservations`);

    // Listings inconnus (supprimés dans Hostaway) : ligne minimale pour garder l'historique.
    const knownListings = new Set((await prisma.hostawayListing.findMany({ select: { id: true } })).map((l) => l.id));
    for (const id of new Set(reservations.map((r) => r.listingMapId))) {
      if (!knownListings.has(id)) {
        await prisma.hostawayListing.create({ data: { id, name: `Listing ${id}`, active: false } });
      }
    }

    const existing = new Map(
      (
        await prisma.reservation.findMany({ select: { id: true, hostawayUpdatedOn: true, financeFetchedAt: true, raw: true } })
      ).map((r) => [r.id, r]),
    );

    const toFetch = reservations.filter((r) => {
      if (!needsFinanceDetail(r)) return false;
      const prev = existing.get(r.id);
      return opts.full || !prev || !prev.financeFetchedAt || prev.hostawayUpdatedOn !== String(r.updatedOn ?? "");
    });
    log(`${toFetch.length} détails financiers à lire`);

    const finance = new Map<number, Record<string, unknown>>();
    const deadline = started + budgetMs;
    let cursor = 0;
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < toFetch.length && Date.now() < deadline) {
        const r = toFetch[cursor++];
        const res = await client.get<Record<string, unknown>>(`/financeStandardField/reservation/${r.id}`);
        finance.set(r.id, res.result ?? {});
        if (finance.size % 50 === 0) log(`  ${finance.size}/${toFetch.length}`);
      }
    });
    await Promise.all(workers);
    const pending = new Set(toFetch.filter((r) => !finance.has(r.id)).map((r) => r.id));

    // Upserts par lots.
    const now = new Date();
    const ops: (() => Promise<unknown>)[] = [];
    for (const r of reservations) {
      if (pending.has(r.id)) continue; // repris à la prochaine synchro
      const prev = existing.get(r.id);
      const fetched = finance.get(r.id);
      // Incrémental : réservation inchangée depuis la dernière synchro → rien à écrire.
      if (!opts.full && prev && !fetched && prev.hostawayUpdatedOn === String(r.updatedOn ?? "")) continue;
      // Détail inchangé : on réutilise celui déjà stocké.
      const prevFinance = (prev?.raw as { finance?: Record<string, unknown> | null } | undefined)?.finance ?? null;
      const fin = fetched ?? (needsFinanceDetail(r) ? prevFinance : null);
      const data = toReservationData(r, fin, fetched ? now : (prev?.financeFetchedAt ?? null));
      ops.push(() => prisma.reservation.upsert({ where: { id: r.id }, create: { id: r.id, ...data }, update: data }));
    }
    // Chaque upsert est idempotent : pas besoin de transaction (et pas de délai de 5 s à tenir).
    for (let i = 0; i < ops.length; i += 10) await Promise.all(ops.slice(i, i + 10).map((op) => op()));
    log(`${ops.length} réservations enregistrées`);

    /* ----------------------- Plateformes et biens auto ---------------------- */
    const channels = await prisma.reservation.groupBy({ by: ["listingId", "channel"] });
    const byListing = new Map<number, string[]>();
    for (const c of channels) byListing.set(c.listingId, [...(byListing.get(c.listingId) ?? []), c.channel].sort());
    for (const [id, list] of byListing) await prisma.hostawayListing.update({ where: { id }, data: { channels: list } });

    const orphans = await prisma.hostawayListing.findMany({ where: { bienId: null, active: true }, orderBy: { id: "asc" } });
    const maxOrder = (await prisma.bien.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
    for (const [i, l] of orphans.entries()) {
      await prisma.bien.create({
        data: { name: l.internalName || l.name || `Listing ${l.id}`, sortOrder: maxOrder + i + 1, listings: { connect: { id: l.id } } },
      });
    }

    const result: SyncResult = {
      status: pending.size ? "partial" : "ok",
      message: pending.size
        ? `${pending.size} réservation(s) restent à lire : elles seront reprises à la prochaine synchronisation.`
        : "Synchronisation terminée.",
      listings: listings.length,
      reservations: reservations.length,
      financeFetched: finance.size,
      financeRemaining: pending.size,
      biensCreated: orphans.length,
      durationMs: Date.now() - started,
    };
    await saveState(result, opts.full && !pending.size);
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const result: SyncResult = { status: "error", message, listings: 0, reservations: 0, financeFetched: 0, financeRemaining: 0, biensCreated: 0, durationMs: Date.now() - started };
    await saveState(result, false).catch(() => {});
    return result;
  } finally {
    await prisma.hostawayState.update({ where: { id: STATE_ID }, data: { syncLockedUntil: null } }).catch(() => {});
  }
}

/** Recalcule les montants depuis les données brutes stockées (sans appel Hostaway). */
export async function remapReservations(): Promise<number> {
  const rows = await prisma.reservation.findMany({ select: { id: true, raw: true } });
  const ops = rows.map((row) => () => {
    const raw = row.raw as { reservation: Record<string, unknown>; finance: Record<string, unknown> | null };
    return prisma.reservation.update({ where: { id: row.id }, data: mapFinance(raw.reservation, raw.finance) });
  });
  for (let i = 0; i < ops.length; i += 10) await Promise.all(ops.slice(i, i + 10).map((op) => op()));
  return rows.length;
}

function toReservationData(r: HostawayReservation, fin: Record<string, unknown> | null, financeFetchedAt: Date | null) {
  const arrival = toDate(r.arrivalDate)!;
  const departure = toDate(r.departureDate)!;
  const nights = typeof r.nights === "number" && r.nights > 0 ? r.nights : Math.max(0, Math.round((+departure - +arrival) / DAY));
  const ref = r.channelReservationId ?? r.reservationId;
  return {
    listingId: r.listingMapId,
    channelId: typeof r.channelId === "number" ? r.channelId : null,
    channel: String(r.channelName ?? "inconnu"),
    channelReservationId: ref ? String(ref) : null,
    status: String(r.status ?? ""),
    arrivalDate: arrival,
    departureDate: departure,
    reservationDate: toDate(r.reservationDate) ?? toDate(r.insertedOn),
    nights,
    currency: String(r.currency ?? "EUR"),
    ...mapFinance(r, fin),
    raw: { reservation: sanitizeReservation(r), finance: compactFinance(fin) } as Prisma.InputJsonValue,
    hostawayUpdatedOn: r.updatedOn ? String(r.updatedOn) : null,
    financeFetchedAt,
  };
}

async function acquireLock(force?: boolean): Promise<boolean> {
  await prisma.hostawayState.upsert({ where: { id: STATE_ID }, create: { id: STATE_ID }, update: {} });
  const now = new Date();
  const { count } = await prisma.hostawayState.updateMany({
    where: force ? { id: STATE_ID } : { id: STATE_ID, OR: [{ syncLockedUntil: null }, { syncLockedUntil: { lt: now } }] },
    data: { syncLockedUntil: new Date(now.getTime() + LOCK_MS) },
  });
  return count === 1;
}

async function saveState(r: SyncResult, full: boolean | undefined) {
  const now = new Date();
  await prisma.hostawayState.update({
    where: { id: STATE_ID },
    data: {
      lastSyncAt: now,
      lastSyncStatus: r.status,
      lastSyncMessage: r.message,
      lastSyncStats: {
        listings: r.listings,
        reservations: r.reservations,
        financeFetched: r.financeFetched,
        financeRemaining: r.financeRemaining,
        biensCreated: r.biensCreated,
        durationMs: r.durationMs,
      },
      ...(full ? { lastFullSyncAt: now } : {}),
    },
  });
}
