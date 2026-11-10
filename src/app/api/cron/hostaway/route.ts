import { syncHostaway } from "@/lib/finances/sync";

// Synchro nocturne (vercel.json → crons). Lecture seule côté Hostaway.
export const maxDuration = 300;

/**
 * Appelée chaque nuit par la tâche planifiée Vercel, qui envoie
 * `Authorization: Bearer <CRON_SECRET>` quand la variable CRON_SECRET est définie.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await syncHostaway({ budgetMs: 240_000 });
  console.log("[cron hostaway]", JSON.stringify(result));
  return Response.json(result, { status: result.status === "error" ? 500 : 200 });
}
