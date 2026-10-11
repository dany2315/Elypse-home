import { prisma } from "@/lib/db";
import { getPlaceLive } from "@/lib/google-places";

/**
 * Photo, note et horaires Google d'une recommandation.
 * Seuls les identifiants présents dans nos livrets sont acceptés (pas de consommation
 * de quota pour des fiches arbitraires).
 */
export async function GET(req: Request, ctx: RouteContext<"/api/places/[placeId]">) {
  const { placeId } = await ctx.params;
  const lang = new URL(req.url).searchParams.get("lang") === "en" ? "en" : "fr";

  const known = await prisma.recommendation.findFirst({ where: { googlePlaceId: placeId }, select: { id: true } });
  if (!known) return Response.json({ error: "Fiche inconnue" }, { status: 404 });

  try {
    const data = await getPlaceLive(placeId, lang);
    return Response.json(data, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Google Maps indisponible" }, { status: 502 });
  }
}
