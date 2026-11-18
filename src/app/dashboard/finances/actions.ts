"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isChargeCategory, VAT_RATES } from "@/lib/finances/charges";
import { validDate } from "@/lib/finances/filters";
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
  revalidatePath("/dashboard/finances/charges");
  // Chiffres du mois sous chaque livret.
  revalidatePath("/dashboard");
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

/** Retire un bien des calculs du rapport financier (ou l'y remet). */
export async function setBienExcluded(bienId: string, excluded: boolean): Promise<Result> {
  await requireSession();
  try {
    await prisma.bien.update({ where: { id: id.parse(bienId) }, data: { excludedFromReports: z.boolean().parse(excluded) } });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* --------------------------------- Charges --------------------------------- */

const day = z.string().refine((d) => validDate(d) !== null, "Date invalide");
const amount = z.number().int().min(0, "Montant invalide").max(100_000_000, "Montant trop élevé");
const vatRate = z
  .number()
  .int()
  .refine((r) => VAT_RATES.some((x) => x.value === r), "Taux de TVA invalide");

const versionInput = z
  .object({
    amountCents: amount,
    vatRateBp: vatRate,
    start: day,
    end: day.nullable(),
    note: z.string().trim().max(300).default(""),
  })
  .refine((v) => v.end === null || v.end >= v.start, { message: "La date de fin doit être après la date de début" });

const versionData = (v: z.infer<typeof versionInput>) => ({
  amountCents: v.amountCents,
  vatRateBp: v.vatRateBp,
  startDate: new Date(`${v.start}T00:00:00Z`),
  endDate: v.end ? new Date(`${v.end}T00:00:00Z`) : null,
  note: v.note,
});

const label = z.string().trim().min(1, "Le libellé est obligatoire").max(80);

export type ChargeVersionInput = z.input<typeof versionInput>;

/** Nouvelle charge d'un bien, avec son premier montant. */
export async function createCharge(input: { bienId: string; category: string; label: string } & ChargeVersionInput): Promise<Result> {
  await requireSession();
  try {
    const bienId = id.parse(input.bienId);
    const category = z.string().refine(isChargeCategory, "Type de charge invalide").parse(input.category);
    const version = versionInput.parse(input);
    const max = (await prisma.bienCharge.aggregate({ where: { bienId }, _max: { sortOrder: true } }))._max.sortOrder ?? 0;
    await prisma.bienCharge.create({
      data: { bienId, category, label: label.parse(input.label), sortOrder: max + 1, versions: { create: versionData(version) } },
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Nouveau montant d'une charge à partir d'une date (et jusqu'à une date facultative). Les
 * versions existantes ne sont pas modifiées : l'historique est conservé.
 */
export async function addChargeVersion(chargeId: string, input: ChargeVersionInput): Promise<Result> {
  await requireSession();
  try {
    const version = versionInput.parse(input);
    await prisma.bienChargeVersion.create({ data: { chargeId: id.parse(chargeId), ...versionData(version) } });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function renameCharge(chargeId: string, name: string): Promise<Result> {
  await requireSession();
  try {
    await prisma.bienCharge.update({ where: { id: id.parse(chargeId) }, data: { label: label.parse(name) } });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Supprime une saisie (erreur de frappe) ; la dernière saisie d'une charge ne se supprime pas seule. */
export async function deleteChargeVersion(versionId: string): Promise<Result> {
  await requireSession();
  try {
    const version = await prisma.bienChargeVersion.findUniqueOrThrow({ where: { id: id.parse(versionId) }, select: { chargeId: true } });
    const count = await prisma.bienChargeVersion.count({ where: { chargeId: version.chargeId } });
    if (count <= 1) return { ok: false, error: "C'est la seule saisie de cette charge : supprimez la charge." };
    await prisma.bienChargeVersion.delete({ where: { id: versionId } });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Supprime une charge et tout son historique. */
export async function deleteCharge(chargeId: string): Promise<Result> {
  await requireSession();
  try {
    await prisma.bienCharge.delete({ where: { id: id.parse(chargeId) } });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
