/**
 * Applique un fichier SQL (généré par `prisma migrate diff`) à la base du .env via le
 * pilote HTTPS de Neon, dans une transaction. Utile quand le port 5432 est bloqué.
 * Refuse de s'exécuter si l'hôte n'est pas celui attendu (garde-fou contre la prod).
 *
 *   pnpm tsx --env-file=.env scripts/apply-sql.ts prisma/sql/2026-11-finances.sql <fragment-d-hôte-attendu>
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

async function main() {
  const [file, expectedHost] = process.argv.slice(2);
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!file || !expectedHost || !url) throw new Error("Usage : apply-sql.ts <fichier.sql> <fragment-d-hôte-attendu>");
  const host = new URL(url).host;
  if (!host.includes(expectedHost)) throw new Error(`Hôte ${host} ≠ ${expectedHost} : arrêt.`);
  const statements = readFileSync(file, "utf8")
    .split(/;\s*$/m)
    .map((s) => s.replace(/^--.*$/gm, "").trim())
    .filter(Boolean);
  const sql = neon(url);
  await sql.transaction(statements.map((s) => sql.query(s)));
  console.log(`${statements.length} instructions appliquées sur ${host.split(".")[0]}`);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
