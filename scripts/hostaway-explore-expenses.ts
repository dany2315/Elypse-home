/**
 * Exploration (lecture seule) des dépenses / frais saisis dans Hostaway, sans données personnelles.
 *   pnpm tsx --env-file=.env scripts/hostaway-explore-expenses.ts
 */
import { prisma } from "../src/lib/db";
import { createHostawayClient } from "../src/lib/hostaway";
import { dbTokenStore } from "../src/lib/finances/sync";

async function main() {
  const client = createHostawayClient({ store: dbTokenStore, maxAttempts: 2 });
  for (const path of ["/expenses", "/financeField", "/ownerStatements", "/expenseCategories"]) {
    try {
      const res = await client.get<unknown>(path, { limit: 200 });
      const list = Array.isArray(res.result) ? (res.result as Record<string, unknown>[]) : [];
      console.log(`\n${path} : ${list.length} élément(s) (count=${res.count ?? "?"})`);
      if (list[0]) console.log("  champs :", Object.keys(list[0]).sort().join(", "));
      for (const e of list.slice(0, 40)) {
        const safe = Object.fromEntries(Object.entries(e).filter(([k, v]) => typeof v === "number" || /date|listing|reservation|categor|type|status|amount|name$/i.test(k)));
        console.log("  ", JSON.stringify(safe).slice(0, 300));
      }
    } catch (err) {
      console.log(`\n${path} : ${err instanceof Error ? err.message : err}`);
    }
  }
}
main().finally(() => prisma.$disconnect());
