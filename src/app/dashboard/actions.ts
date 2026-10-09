"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateLivretToken } from "@/lib/token";

/* --------------------------------- Schémas -------------------------------- */

const str = z.string().trim().default("");
const loc = z.object({ fr: str, en: str }).default({ fr: "", en: "" });
const optId = z.string().nullish().transform((v) => v || null);
const coord = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  });

const livretSchema = z.object({
  name: z.string().trim().min(1, "Le nom interne est obligatoire"),
  title: z.string().trim().min(1, "Le titre est obligatoire"),
  address: str,
  city: str,
  latitude: coord,
  longitude: coord,
  active: z.boolean().default(true),
  coverImageId: optId,
  checkinTime: str,
  buildingCode: str,
  buildingInstructions: loc,
  accessType: str,
  keyboxCode: str,
  keyInstructions: loc,
  facadeImageIds: z.array(z.string()).default([]),
  videoUrl: str,
  welcomeMessage: loc,
  parking: loc,
  wifiSsid: str,
  wifiPassword: str,
  rules: loc,
  essentials: loc,
  checkoutTime: str,
  checkoutInstructions: loc,
  contactName: str,
  contactSubtitle: str,
  contactPhone: str,
  contactEmail: str,
  footerText: str,
});
export type LivretInput = z.input<typeof livretSchema>;

const itemSchemas = {
  recommendation: z.object({
    name: z.string().trim().min(1, "Le nom est obligatoire"),
    category: str,
    address: str,
    description: loc,
    imageId: optId,
    phone: str,
    website: str,
    travelTime: str,
    travelMode: str,
  }),
  equipment: z.object({
    name: z.object({ fr: z.string().trim().min(1, "Le nom est obligatoire"), en: str }),
    category: str,
    icon: str,
    instructions: loc,
    imageId: optId,
    tip: loc,
    tipType: str,
  }),
  transport: z.object({
    name: z.string().trim().min(1, "Le nom est obligatoire"),
    type: str,
    line: str,
    color: str,
    detail: loc,
    phone: str,
    address: str,
    url: str,
  }),
  contact: z.object({
    name: z.string().trim().min(1, "Le nom est obligatoire"),
    type: str,
    phone: str,
    address: str,
    detail: loc,
  }),
};
export type ItemKind = keyof typeof itemSchemas;
export type ItemInput<K extends ItemKind> = z.input<(typeof itemSchemas)[K]>;

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Données invalides" };
  console.error(e);
  return { ok: false, error: "Une erreur est survenue. Réessayez." };
}

function refresh(livretId?: string) {
  revalidatePath("/dashboard");
  if (livretId) revalidatePath(`/dashboard/livrets/${livretId}`);
  revalidatePath("/l/[token]", "page");
}

/** Délégués Prisma par type d'élément (évite un switch dans chaque action). */
function delegate(kind: ItemKind) {
  const map = {
    recommendation: prisma.recommendation,
    equipment: prisma.equipment,
    transport: prisma.transport,
    contact: prisma.contact,
  } as const;
  // Les quatre modèles partagent id / livretId / sortOrder : on les manipule de façon uniforme.
  return map[kind] as unknown as {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<{ id: string; livretId: string }>;
    delete(args: { where: { id: string } }): Promise<{ id: string; livretId: string }>;
    aggregate(args: { where: { livretId: string }; _max: { sortOrder: true } }): Promise<{ _max: { sortOrder: number | null } }>;
  };
}

/* --------------------------------- Livrets -------------------------------- */

export async function updateLivret(id: string, input: LivretInput): Promise<Result> {
  try {
    await requireSession();
    const data = livretSchema.parse(input);
    await prisma.livret.update({ where: { id }, data });
    refresh(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setLivretActive(id: string, active: boolean): Promise<Result> {
  try {
    await requireSession();
    await prisma.livret.update({ where: { id }, data: { active } });
    refresh(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Génère un nouveau lien : l'ancien cesse immédiatement de fonctionner. */
export async function regenerateLivretToken(id: string): Promise<Result<string>> {
  try {
    await requireSession();
    const { token } = await prisma.livret.update({
      where: { id },
      data: { token: generateLivretToken() },
    });
    refresh(id);
    return { ok: true, data: token };
  } catch (e) {
    return fail(e);
  }
}

export async function reorderLivrets(ids: string[]): Promise<Result> {
  try {
    await requireSession();
    await prisma.$transaction(ids.map((id, i) => prisma.livret.update({ where: { id }, data: { sortOrder: i } })));
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* --------------------- Recos / Équipements / Transport / Contacts --------------------- */

export async function saveItem<K extends ItemKind>(
  kind: K,
  livretId: string,
  itemId: string | null,
  input: ItemInput<K>,
): Promise<Result<string>> {
  try {
    await requireSession();
    const data = itemSchemas[kind].parse(input) as Record<string, unknown>;
    const model = delegate(kind);
    let id = itemId;
    if (id) {
      await model.update({ where: { id }, data });
    } else {
      const last = await model.aggregate({ where: { livretId }, _max: { sortOrder: true } });
      ({ id } = await model.create({
        data: { ...data, livretId, sortOrder: (last._max.sortOrder ?? -1) + 1 },
      }));
    }
    refresh(livretId);
    return { ok: true, data: id! };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteItem(kind: ItemKind, itemId: string): Promise<Result> {
  try {
    await requireSession();
    const { livretId } = await delegate(kind).delete({ where: { id: itemId } });
    refresh(livretId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reorderItems(kind: ItemKind, livretId: string, ids: string[]): Promise<Result> {
  try {
    await requireSession();
    const model = delegate(kind);
    await Promise.all(ids.map((id, i) => model.update({ where: { id }, data: { sortOrder: i } })));
    refresh(livretId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------------------------- Images --------------------------------- */

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function uploadImage(formData: FormData): Promise<Result<string>> {
  try {
    await requireSession();
    const file = formData.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      return { ok: false, error: "Fichier image invalide." };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, error: "Image trop lourde (4 Mo maximum après compression)." };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const img = await prisma.image.create({
      data: {
        data: bytes,
        mimeType: file.type,
        size: bytes.byteLength,
        width: Number(formData.get("width")) || null,
        height: Number(formData.get("height")) || null,
      },
      select: { id: true },
    });
    return { ok: true, data: img.id };
  } catch (e) {
    return fail(e);
  }
}
