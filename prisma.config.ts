import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Connexion directe (sans pooler) pour les commandes Prisma CLI.
    url: env("DATABASE_URL_UNPOOLED"),
  },
});
