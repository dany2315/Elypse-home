"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncHostaway } from "@/lib/finances/sync";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Données invalides" };
  console.error(e);
  return { ok: false, error: "Une erreur est survenue. Réessayez." };
}

function refresh() {
  revalidatePath("/dashboard/finances");
  revalidatePath("/dashboard/finances/biens");
}

/* ------------------------------ Synchronisation ----------------------------- */

/** Bouton « Actualiser depuis Hostaway » : synchro incrémentale (lecture seule côté Hostaway). */
export async function syncFromHostaway(): Promise<Result<string>> {
  await requireSession();
  try {
    // Budget sous la durée maximale de la page (maxDuration = 300 s).
    const r = await syncHostaway({ budgetMs: 200_000 });
    refresh();
    if (r.status === "error") return { ok: false, error: `Hostaway : ${r.message}` };
    if (r.status === "locked") return { ok: false, error: r.message };
    const detail = `${r.reservations} réservations, ${r.financeFetched} détail(s) financier(s) relu(s)`;
    return { ok: true, data: r.status === "partial" ? `${detail}. ${r.message}` : `${detail}.` };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------------------------- Biens ---------------------------------- */

const id = z.string().min(1);

export async function renameBien(bienId: string, name: string): Promise<Result> {
  await requireSession();
  try {
    const clean = z.string().trim().min(1, "Le nom est obligatoire").max(120).parse(name);
    await prisma.bien.update({ where: { id: id.parse(bienId) }, data: { name: clean } });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setBienLivret(bienId: string, livretId: string | null): Promise<Result> {
  await requireSession();
  try {
    await prisma.bien.update({ where: { id: id.parse(bienId) }, data: { livretId: livretId || null } });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Fusionne `sourceId` dans `targetId` : les listings passent dans le bien cible, la source est supprimée. */
export async function mergeBiens(sourceId: string, targetId: string): Promise<Result> {
  await requireSession();
  try {
    if (id.parse(sourceId) === id.parse(targetId)) return { ok: false, error: "Choisissez un autre bien" };
    await prisma.$transaction([
      prisma.hostawayListing.updateMany({ where: { bienId: sourceId }, data: { bienId: targetId } }),
      prisma.bien.delete({ where: { id: sourceId } }),
    ]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Sort un listing de son bien et lui crée son propre bien. */
export async function detachListing(listingId: number): Promise<Result> {
  await requireSession();
  try {
    const listing = await prisma.hostawayListing.findUniqueOrThrow({ where: { id: z.number().int().parse(listingId) } });
    const max = (await prisma.bien.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
    const previous = listing.bienId;
    await prisma.$transaction(async (tx) => {
      await tx.bien.create({
        data: { name: listing.internalName || listing.name || `Listing ${listing.id}`, sortOrder: max + 1, listings: { connect: { id: listing.id } } },
      });
      // Bien laissé vide : supprimé.
      if (previous && (await tx.hostawayListing.count({ where: { bienId: previous } })) === 0) {
        await tx.bien.delete({ where: { id: previous } });
      }
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Crée un bien pour chaque listing qui n'en a pas (proposition automatique). */
export async function proposeBiens(): Promise<Result<number>> {
  await requireSession();
  try {
    const orphans = await prisma.hostawayListing.findMany({ where: { bienId: null }, orderBy: { id: "asc" } });
    const max = (await prisma.bien.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
    for (const [i, l] of orphans.entries()) {
      await prisma.bien.create({
        data: { name: l.internalName || l.name || `Listing ${l.id}`, sortOrder: max + i + 1, listings: { connect: { id: l.id } } },
      });
    }
    refresh();
    return { ok: true, data: orphans.length };
  } catch (e) {
    return fail(e);
  }
}
