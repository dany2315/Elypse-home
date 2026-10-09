import { prisma } from "@/lib/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/images/[id]">) {
  const { id } = await ctx.params;
  const img = await prisma.image.findUnique({ where: { id } }).catch(() => null);
  if (!img) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(img.data), {
    headers: {
      "Content-Type": img.mimeType,
      "Content-Length": String(img.size),
      // Une image n'est jamais modifiée : un remplacement crée un nouvel identifiant.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
