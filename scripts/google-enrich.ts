/**
 * Associe chaque recommandation à sa fiche Google Maps (Places API) et complète
 * téléphone, site web et adresse s'ils sont vides (rien n'est écrasé).
 * Seules ces informations et l'identifiant de fiche sont enregistrés : la clé API
 * n'est utilisée que le temps du script et n'a pas à rester dans le projet.
 *
 * GOOGLE_MAPS_API_KEY=… pnpm google:enrich           → rapport uniquement
 * GOOGLE_MAPS_API_KEY=… pnpm google:enrich --apply   → enregistre les correspondances fiables
 */
import { prisma } from "../src/lib/db";
import { searchPlace } from "../src/lib/google-places";

const APPLY = process.argv.includes("--apply");

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Correspondances vérifiées à la main comme fausses (autre ville, autre établissement, autre boutique). */
const SKIP: ((r: { name: string; address: string }) => boolean)[] = [
  (r) => norm(r.name) === "sushi love",
  (r) => norm(r.name) === "bottega romana",
  (r) => norm(r.name) === "maison landemaine",
  (r) => norm(r.name) === "carrefour city" && !r.address,
];

/** Requêtes précisées quand l'adresse saisie mène à une autre fiche. */
const QUERY: Record<string, string> = {
  "tour eiffel": "Tour Eiffel, Avenue Gustave Eiffel, 75007 Paris",
};

/** Annuaires tiers : on ne les présente pas comme « site web » de l'établissement. */
const NOT_A_WEBSITE = ["moodmap.paris"];

function cleanWebsite(url: string) {
  if (!url || NOT_A_WEBSITE.some((h) => url.includes(h))) return "";
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|igshid$|hl$)/.test(k)) u.searchParams.delete(k);
    return u.toString().replace(/\?$/, "");
  } catch {
    return url;
  }
}

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
    select: { id: true, name: true, address: true, phone: true, website: true },
  });

  // Une seule recherche par établissement (certains apparaissent dans plusieurs livrets).
  const groups = new Map<string, typeof recos>();
  for (const r of recos) {
    const k = `${norm(r.name)}|${norm(r.address)}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  let saved = 0;
  let skipped = 0;
  for (const rows of groups.values()) {
    const r = rows[0];
    if (SKIP.some((rule) => rule(r))) {
      skipped++;
      console.log(`–  ${r.name} — écarté (correspondance fausse)`);
      continue;
    }
    const query = QUERY[norm(r.name)] ?? [r.name.replace(/\s*★+/g, ""), r.address || "Paris"].join(", ");
    const match = await searchPlace(query).catch((e) => {
      console.error(`✗ ${r.name} : ${(e as Error).message}`);
      return null;
    });
    if (!match || similarity(r.name, match.name) < 0.3) {
      skipped++;
      console.log(`∅  ${r.name} — pas de fiche fiable${match ? ` (${match.name})` : ""}`);
      continue;
    }
    const website = cleanWebsite(match.website);
    console.log(`✓  ${r.name} → ${match.name} · ${match.address}${match.phone ? ` · ${match.phone}` : ""}${website ? ` · ${website}` : ""}`);

    if (APPLY) {
      for (const row of rows) {
        await prisma.recommendation.update({
          where: { id: row.id },
          data: {
            googlePlaceId: match.id,
            phone: row.phone || match.phone,
            website: row.website || website,
            address: row.address || match.address,
          },
        });
        saved++;
      }
    }
  }
  console.log(`\n${APPLY ? `${saved} recommandations enregistrées` : "rapport seulement"} · ${skipped} écartées`);
}

main().finally(() => prisma.$disconnect());
