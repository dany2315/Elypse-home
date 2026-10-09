import { headers } from "next/headers";

/** URL publique du site, déduite de la requête (fonctionne en local comme sur Vercel). */
export async function getBaseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "http://localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function livretPath(token: string) {
  return `/l/${token}`;
}
