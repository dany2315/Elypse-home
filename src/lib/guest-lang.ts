import { cookies, headers } from "next/headers";
import type { Lang } from "@/lib/localized";

/** Langue choisie par le voyageur (cookie), sinon celle de son téléphone. */
export async function guestLang(): Promise<Lang> {
  const stored = (await cookies()).get("elypse-lang")?.value;
  if (stored === "fr" || stored === "en") return stored;
  const accept = (await headers()).get("accept-language") ?? "";
  return accept.toLowerCase().startsWith("fr") || !accept ? "fr" : "en";
}
