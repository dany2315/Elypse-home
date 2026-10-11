/**
 * Associe chaque recommandation à sa fiche Google Maps (Places API) et complète
 * téléphone, site web et adresse s'ils sont vides (rien n'est écrasé).
 *
 * pnpm google:enrich           → rapport uniquement (aucune écriture)
 * pnpm google:enrich --apply   → enregistre les correspondances jugées fiables
 * pnpm google:enrich --apply --force-all → enregistre aussi les correspondances douteuses
 */
import { prisma } from "../src/lib/db";
import { searchPlace } from "../src/lib/google-places";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force-all");

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Part des mots du nom saisi retrouvés dans le nom Google (0 → 1). */
function similarity(ours: string, theirs: string) {
  const stop = new Set(["le", "la", "les", "de", "du", "des", "l", "d", "et", "paris", "cafe", "restaurant", "bar"]);
  const words = norm(ours).split(" ").filter((w) => w.length > 1 && !stop.has(w));
  if (!words.length) return 1;
  const target = norm(theirs);
  return words.filter((w) => target.includes(w)).length / words.length;
}

async function main() {
  const recos = await prisma.recommendation.findMany({
    select: { id: true, name: true, address: true, phone: true, website: true, googlePlaceId: true },
  });

  // Une seule recherche par établissement (certains apparaissent dans plusieurs livrets).
  const groups = new Map<string, typeof recos>();
  for (const r of recos) {
    const k = `${norm(r.name)}|${norm(r.address)}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  let ok = 0;
  let doubtful = 0;
  let missing = 0;
  for (const rows of groups.values()) {
    const r = rows[0];
    const query = [r.name.replace(/\s*★+/g, ""), r.address || "Paris"].join(", ");
    const match = await searchPlace(query).catch((e) => {
      console.error(`✗ ${r.name} : ${(e as Error).message}`);
      return null;
    });
    if (!match) {
      missing++;
      console.log(`∅  ${r.name} — aucune fiche trouvée`);
      continue;
    }
    const score = similarity(r.name, match.name);
    const reliable = score >= 0.5;
    if (reliable) ok++;
    else doubtful++;
    console.log(
      `${reliable ? "✓" : "?"}  ${r.name}  →  ${match.name} · ${match.address}` +
        `${match.phone ? ` · ${match.phone}` : ""}${match.website ? ` · ${match.website}` : ""}`,
    );

    if (APPLY && (reliable || FORCE)) {
      for (const row of rows) {
        await prisma.recommendation.update({
          where: { id: row.id },
          data: {
            googlePlaceId: match.id,
            phone: row.phone || match.phone,
            website: row.website || match.website,
            address: row.address || match.address,
          },
        });
      }
    }
  }
  console.log(`\n${ok} fiables, ${doubtful} douteuses, ${missing} introuvables — ${APPLY ? "enregistré" : "rapport seulement"}`);
}

main().finally(() => prisma.$disconnect());
