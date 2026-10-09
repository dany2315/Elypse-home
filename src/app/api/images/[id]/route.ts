import { prisma } from "@/lib/db";

/** Sert une photo (ou une vidéo) stockée en base. Gère les requêtes « Range » (lecture vidéo sur iPhone). */
export async function GET(req: Request, ctx: RouteContext<"/api/images/[id]">) {
  const { id } = await ctx.params;
  const media = await prisma.image.findUnique({ where: { id } }).catch(() => null);
  if (!media) return new Response("Not found", { status: 404 });

  const bytes = Buffer.from(media.data);
  const headers: Record<string, string> = {
    "Content-Type": media.mimeType,
    "Accept-Ranges": "bytes",
    // Un média n'est jamais modifié : un remplacement crée un nouvel identifiant.
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const size = bytes.byteLength;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new Response(bytes.subarray(start, end + 1), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  return new Response(bytes, { headers: { ...headers, "Content-Length": String(bytes.byteLength) } });
}
