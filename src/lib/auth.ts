import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

/**
 * Hôtes autorisés : local, URLs Vercel (fournies automatiquement par Vercel :
 * production, branche, déploiement) et domaine personnalisé éventuel (BETTER_AUTH_URL).
 * Aucune variable à renseigner sur Vercel tant qu'on n'utilise pas de domaine perso.
 */
const hostOf = (url?: string) => (url ? new URL(url).host : undefined);
const { BETTER_AUTH_URL, VERCEL_PROJECT_PRODUCTION_URL, VERCEL_BRANCH_URL, VERCEL_URL } = process.env;

const allowedHosts = [
  "localhost:*",
  "127.0.0.1:*",
  hostOf(BETTER_AUTH_URL),
  VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_BRANCH_URL,
  VERCEL_URL,
].filter((h): h is string => Boolean(h));

const fallback =
  BETTER_AUTH_URL ?? (VERCEL_PROJECT_PRODUCTION_URL ? `https://${VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const auth = betterAuth({
  baseURL: { allowedHosts, fallback },
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // Accès privé : le compte administrateur est créé par `pnpm db:seed`.
    disableSignUp: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  plugins: [nextCookies()],
});

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** À appeler en tête de chaque page et de chaque action du dashboard. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
