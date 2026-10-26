import { headers } from "next/headers";
import { SITE_URL } from "@/lib/site";

/**
 * URL publique des liens voyageurs.
 * En production, toujours https://elypsehome.com (ou PUBLIC_URL) : les adresses Vercel
 * secondaires sont protégées par une connexion Vercel, et Booking n'accepte que les domaines
 * approuvés.
 * En local et sur les previews, l'adresse de la requête.
 */
export async function getBaseUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "production") return SITE_URL;
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
