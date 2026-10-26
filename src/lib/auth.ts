import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SITE_HOSTS, SITE_URL } from "@/lib/site";

/**
 * Hôtes autorisés : local, URLs Vercel (fournies automatiquement par Vercel :
 * production, branche, déploiement), domaine officiel elypsehome.com (+ www) et BETTER_AUTH_URL éventuel.
 */
const hostOf = (url?: string) => (url ? new URL(url).host : undefined);
const { BETTER_AUTH_URL, VERCEL_PROJECT_PRODUCTION_URL, VERCEL_BRANCH_URL, VERCEL_URL } = process.env;

const allowedHosts = [
  "localhost:*",
  "127.0.0.1:*",
  ...SITE_HOSTS,
  hostOf(BETTER_AUTH_URL),
  VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_BRANCH_URL,
  VERCEL_URL,
].filter((h): h is string => Boolean(h));

const fallback = BETTER_AUTH_URL ?? (process.env.VERCEL_ENV === "production" ? SITE_URL : "http://localhost:3000");

export const auth = betterAuth({
  baseURL: { allowedHosts, fallback },
  trustedOrigins: SITE_HOSTS.map((h) => `https://${h}`),
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
