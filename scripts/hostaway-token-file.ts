// Stockage du jeton Hostaway pour les scripts locaux : fichier dans node_modules/.cache
// (ignoré par git), pour ne pas redemander un jeton à chaque exécution.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { TokenStore } from "../src/lib/hostaway";

const FILE = join(process.cwd(), "node_modules", ".cache", "elypse", "hostaway-token");

export const fileTokenStore: TokenStore = {
  async get() {
    try {
      return readFileSync(FILE, "utf8").trim() || null;
    } catch {
      return null;
    }
  },
  async set(token) {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, token, { mode: 0o600 });
  },
  async clear() {
    rmSync(FILE, { force: true });
  },
};
