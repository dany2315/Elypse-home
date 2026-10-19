import { headers } from "next/headers";

/**
 * URL publique des liens voyageurs.
 * En production, toujours l'adresse publique (domaine perso via PUBLIC_URL, sinon le domaine
 * de production Vercel) : les autres adresses Vercel (…-dany2315s-projects.vercel.app) sont
 * protégées par une connexion Vercel et ne s'ouvriraient pas chez les voyageurs.
 * En local et sur les previews, l'adresse de la requête.
 */
export async function getBaseUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "http://localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function livretPath(token: string) {
  return `/l/${token}`;
}

/** Page « Emplacement » : photos de l'adresse + accès au livret. */
export function emplacementPath(token: string) {
  return `/l/${token}/emplacement`;
}
