/**
 * pnpm db:import            → importe les 10 livrets existants (methodeatlas) dans la base
 * pnpm db:import --dry-run  → affiche les données extraites sans rien écrire
 *
 * Le script lit chaque livret public, télécharge ses photos (et vidéo), puis
 * crée ou remplace le livret du même nom. Le jeton (lien voyageur) d'un livret
 * déjà importé est conservé. Les livrets de démonstration sont supprimés.
 * Le passage « Besoin de plus de temps ? » (départ tardif) n'est volontairement pas repris.
 */
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import sharp from "sharp";
import { prisma } from "../src/lib/db";
import { generateLivretToken } from "../src/lib/token";

const SOURCES: { name: string; id: string }[] = [
  { name: "Sourdière", id: "rec7e8ea100600b4c7688147a420f43b3c5" },
  { name: "Toudic", id: "rec67c27b7b720b4b1ea181e9f099eab40a" },
  { name: "Bosquet", id: "recba30d21602864233a63dc61ee14e5ddd" },
  { name: "Nollet", id: "rec32e538a4241845119e6bb8e038be47ae" },
  { name: "Bartholdi", id: "rec967d52a04e424cd0b260dc3dc6ab7122" },
  { name: "157 Amelot", id: "recfaf1377aa1264e6587d6aa8f3b065d29" },
  { name: "62 Amelot", id: "reca2c67ec56feb409f8d1820eafb21550d" },
  { name: "Saint-Martin", id: "rec4c260cd2f03346d1a26c6a15bda2b5be" },
  { name: "Miromesnil", id: "recf4373fafdcfe44528df4f853f5c9db21" },
  { name: "Vaneau", id: "rec062a76fe6f0b4e42987a0c0591b39ce4" },
];
const BASE = "https://app.methodeatlas.fr";
const DRY = process.argv.includes("--dry-run");

type L = { fr: string; en: string };
type $ = cheerio.CheerioAPI;

/* --------------------------------- Helpers -------------------------------- */

const clean = (s: string | undefined) =>
  (s ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Lit les variantes data-lang="fr" / "en" d'un bloc. */
function bi($: $, scope: cheerio.Cheerio<AnyNode>, selector = "[data-lang]"): L {
  const pick = (lang: string) => clean(scope.find(`${selector}[data-lang="${lang}"]`).first().text());
  return { fr: pick("fr"), en: pick("en") };
}

/** Adresse contenue dans un lien Google Maps. */
function mapsQuery(href: string | undefined) {
  if (!href) return "";
  try {
    return new URL(href).searchParams.get("query") ?? "";
  } catch {
    return "";
  }
}

const stripEmoji = (s: string) => s.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, "").trim();

const RECO_CAT: Record<string, string> = {
  restaurant: "restaurant", boulangerie: "boulangerie", café: "cafe", cafe: "cafe", bar: "bar",
  commerce: "commerce", courses: "courses", marché: "marche", culture: "culture",
  activité: "activite", balade: "balade", plage: "plage",
};
const EQUIP_CAT: Record<string, string> = {
  cuisine: "cuisine", salon: "salon", chambre: "chambre", "salle de bain": "salle-de-bain",
  buanderie: "buanderie", confort: "confort", extérieur: "exterieur",
};
const ACCESS: Record<string, string> = {
  "boîte à clé fixe": "boite-a-cle", "boîte à clé": "boite-a-cle", keynest: "keynest",
  "serrure connectée": "serrure-connectee", "remise en main propre": "main-propre", autre: "autre",
};
const CONTACT_ICON: Record<string, string> = {
  "💊": "pharmacie", "🩺": "medecin", "🖥️": "teleconsultation", "🏥": "hopital", "🦷": "dentiste", "🐾": "veterinaire",
};

/* ---------------------------------- Médias --------------------------------- */

const mediaCache = new Map<string, string | null>();

async function importImage(url: string | undefined): Promise<string | null> {
  if (!url) return null;
  const abs = new URL(url, BASE).toString();
  if (mediaCache.has(abs)) return mediaCache.get(abs)!;
  if (DRY) {
    mediaCache.set(abs, `dry:${abs}`);
    return `dry:${abs}`;
  }
  try {
    const res = await fetch(abs);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const input = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(input)
      .rotate()
      .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const img = await prisma.image.create({
      data: { data: new Uint8Array(data), mimeType: "image/webp", size: data.byteLength, width: info.width, height: info.height },
      select: { id: true },
    });
    mediaCache.set(abs, img.id);
    return img.id;
  } catch (e) {
    console.warn(`   ⚠ photo ignorée (${abs}) : ${(e as Error).message}`);
    mediaCache.set(abs, null);
    return null;
  }
}

/** Vidéo : copiée dans la base si elle est téléchargeable (≤ 40 Mo), sinon lien d'origine. */
async function importVideo(url: string | undefined): Promise<string> {
  if (!url) return "";
  const abs = new URL(url, BASE).toString();
  if (DRY) return abs;
  try {
    const res = await fetch(abs);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 1000 || buf.byteLength > 40 * 1024 * 1024) throw new Error(`taille ${buf.byteLength}`);
    const media = await prisma.image.create({
      data: { data: buf, mimeType: res.headers.get("content-type") ?? "video/mp4", size: buf.byteLength },
      select: { id: true },
    });
    return `/api/images/${media.id}`;
  } catch (e) {
    console.warn(`   ⚠ vidéo non copiée (${abs}) : ${(e as Error).message} — lien d'origine conservé`);
    return abs;
  }
}

/** Photo principale d'une balise <picture> (WebP en priorité). */
function pictureUrl($: $, el: cheerio.Cheerio<AnyNode>) {
  return el.find('source[type="image/webp"]').attr("srcset") ?? el.find("img").attr("src");
}

/* ---------------------------------- Parsing -------------------------------- */

async function parseLivret(html: string) {
  const $ = cheerio.load(html);
  const page = (id: string) => $(`#page-${id}`);

  // Accueil
  const title = clean($(".hero-title").first().text());
  const city = clean($(".hero-subtitle").first().text()) || "Paris";
  const heroStyle = $(".hero").attr("style") ?? "";
  const heroUrl = heroStyle.match(/url\('([^']+\.webp)'\)/)?.[1] ?? heroStyle.match(/url\('([^']+)'\)/)?.[1];

  // Arrivée
  const checkin = page("checkin");
  const checkinTime = clean(checkin.find(".info-row-value strong").first().text()) || "16:00";
  const steps = checkin.find(".step");
  const stepBy = (key: string) => steps.filter((_, s) => $(s).find(`.step-title[data-i18n="${key}"]`).length > 0).first();

  const findStep = stepBy("step_find");
  const buildingCode = clean(findStep.find(".pin-code").first().text());
  const buildingInstructions = bi($, findStep.find(".step-detail-inner"), "> span");

  const keysStep = stepBy("step_keys");
  const keysDesc = clean(keysStep.find(".step-desc").first().text());
  const [accessLabel, codePart] = keysDesc.split("·").map((s) => s.trim());
  const accessType = ACCESS[(accessLabel ?? "").toLowerCase()] ?? (accessLabel ? "autre" : "");
  const keyboxCode = codePart?.replace(/^Code\s*:\s*/i, "").trim() ?? "";
  const keyInstructions = bi($, keysStep.find(".step-detail-inner"), "> span");

  const welcomeStep = stepBy("step_welcome");
  const customWelcome = welcomeStep.find(".step-detail-inner > span[data-lang]");
  const welcomeMessage = customWelcome.length ? bi($, welcomeStep.find(".step-detail-inner"), "> span") : { fr: "", en: "" };

  const facadeUrls = checkin
    .find(".content-card picture")
    .toArray()
    .map((p) => pictureUrl($, $(p)))
    .filter(Boolean) as string[];
  const videoSrc = checkin.find("video").attr("src");

  // Séjour
  const wifiValues = page("wifi").find(".info-row-value.mono");
  const wifiSsid = clean(wifiValues.eq(0).text());
  const wifiPassword = clean(wifiValues.eq(1).text());
  const parking = bi($, page("parking"), "p");
  const rules = bi($, page("regles"), "p");
  const essentials: L = {
    fr: page("equipements").find('.essentials-tags[data-lang="fr"] .e-tag').toArray().map((e) => clean($(e).text())).join(", "),
    en: page("equipements").find('.essentials-tags[data-lang="en"] .e-tag').toArray().map((e) => clean($(e).text())).join(", "),
  };

  // Adresse
  const addressHtml = page("adresse").find(".info-row-value").first().html() ?? "";
  const address = clean(cheerio.load(addressHtml.split(/<br\s*\/?>/i)[0] ?? "").text());

  // Départ
  const checkout = page("checkout");
  const checkoutTime = clean(checkout.find(".info-row-value strong").first().text()) || "10:00";
  const checkoutCard = checkout.find(".content-card").filter((_, c) => $(c).find('[data-i18n="before_leaving"]').length > 0).first();
  const checkoutInstructions = bi($, checkoutCard, "p");

  // Assistance
  const assistance = page("assistance");
  const hostCard = assistance.find(".content-card").first();
  const contactName = clean(hostCard.find("div[style*='Playfair']").first().text()) || "Elypse Home";
  const contactSubtitle = clean(hostCard.find("div[style*='Playfair']").first().next().text());
  const rows = hostCard.find(".info-row-value");
  const contactPhone = clean(rows.filter(".mono").first().text());
  const contactEmail = clean(rows.filter((_, r) => /@/.test($(r).text())).first().text());
  const footerText = clean($(".footer-brand").first().text()).replace(/✦/g, "").trim() || "Elypse Home";

  // Contacts utiles (tout ce qui n'est pas 15 / 17 / 18 / 112)
  const contacts = assistance
    .find("a.urgence-btn")
    .toArray()
    .filter((a) => !["tel:15", "tel:17", "tel:18", "tel:112"].includes($(a).attr("href") ?? ""))
    .map((a, i) => {
      const el = $(a);
      const icon = clean(el.find(".urgence-btn-icon").text());
      const detail = el.find(".urgence-btn-detail");
      const phone = (el.attr("href") ?? "").replace(/^tel:/, "").trim();
      const plain = (detail.clone().children("span").remove().end().html() ?? "")
        .split(/<br\s*\/?>/i)
        .map((s) => clean(cheerio.load(s).text()))
        .filter((s) => s && s !== phone);
      return {
        name: clean(el.find(".urgence-btn-name").text()),
        type: CONTACT_ICON[icon] ?? "autre",
        phone,
        address: plain[0] ?? "",
        detail: bi($, detail, "span"),
        sortOrder: i,
      };
    });

  // Recommandations
  const recos: Array<Record<string, unknown> & { photo?: string }> = [];
  page("restaurants")
    .find(".reco-accordion")
    .each((_, acc) => {
      const label = clean($(acc).find(".reco-acc-trigger span").eq(1).text()).toLowerCase();
      const category = RECO_CAT[label] ?? "autre";
      $(acc)
        .find(".reco-card")
        .each((__, card) => {
          const c = $(card);
          const badge = clean(c.find(".travel-badge").text());
          const mode = badge.startsWith("🚶") ? "pied" : badge.startsWith("⛴") ? "bateau" : badge ? "voiture" : "";
          recos.push({
            name: stripEmoji(clean(c.find(".reco-card-name").text())),
            category,
            address: mapsQuery(c.find("a.reco-action-map").attr("href")),
            description: bi($, c, ".reco-card-desc"),
            phone: (c.find("a.reco-action-call").attr("href") ?? "").replace(/^tel:/, "").trim(),
            website: c.find("a.reco-action-web, a[href^='http']:not(.reco-action-map):not(.reco-action-waze)").attr("href") ?? "",
            travelTime: stripEmoji(badge),
            travelMode: mode,
            sortOrder: recos.length,
            photo: c.find("img").attr("src"),
          });
        });
    });

  // Équipements
  const equipments: Array<Record<string, unknown> & { photo?: string }> = [];
  page("equipements")
    .find(".equip-category")
    .each((_, cat) => {
      const label = stripEmoji(clean($(cat).find(".equip-category-label").text())).toLowerCase();
      const category = EQUIP_CAT[label] ?? "autre";
      $(cat)
        .find(".equip-item")
        .each((__, item) => {
          const it = $(item);
          const tipEl = it.find(".equip-detail-tip");
          const tipText = (lang: string) => clean(tipEl.filter(`[data-lang="${lang}"]`).find("span").last().text());
          const tipIcon = clean(tipEl.first().find("span").first().text());
          equipments.push({
            name: { fr: clean(it.find(".equip-trigger-name").text()), en: "" },
            category,
            icon: clean(it.find(".equip-trigger-icon").text()),
            instructions: bi($, it.find(".equip-detail-inner"), "p"),
            tip: { fr: tipText("fr"), en: tipText("en") },
            tipType: tipIcon.includes("⚠") ? "warning" : "info",
            sortOrder: equipments.length,
            photo: it.find(".equip-detail img").attr("src"),
          });
        });
    });

  // Transport
  const transports = page("transport")
    .find(".content-card")
    .toArray()
    .map((card, i) => {
      const c = $(card);
      const icon = clean(c.find(".content-card-icon").text());
      const name = clean(c.find(".content-card-title").text());
      const cta = c.find("a.cta-btn").attr("href");
      if (cta) {
        return { name, type: "plan", line: "", color: "", detail: { fr: "", en: "" }, phone: "", address: "", url: cta, sortOrder: i };
      }
      const badge = c.find(".transport-badge").first();
      return {
        name,
        type: icon === "🚆" ? "rer" : icon === "🚌" ? "bus" : "metro",
        line: clean(badge.text()),
        color: (badge.attr("style") ?? "").match(/background:\s*(#[0-9a-f]{3,8})/i)?.[1] ?? "",
        detail: bi($, c, ".transport-detail"),
        phone: (c.find("a[href^='tel:']").attr("href") ?? "").replace(/^tel:/, "").trim(),
        address: mapsQuery(c.find("a.reco-action-map").attr("href")),
        url: "",
        sortOrder: i,
      };
    });

  return {
    livret: {
      title, city, address, checkinTime, buildingCode, buildingInstructions, accessType, keyboxCode, keyInstructions,
      welcomeMessage, parking, wifiSsid, wifiPassword, rules, essentials, checkoutTime, checkoutInstructions,
      contactName, contactSubtitle, contactPhone, contactEmail, footerText,
    },
    heroUrl,
    facadeUrls,
    videoSrc,
    recos,
    equipments,
    transports,
    contacts,
  };
}

/* ---------------------------------- Import --------------------------------- */

async function removeLivret(id: string) {
  const old = await prisma.livret.findUnique({
    where: { id },
    include: { recommendations: true, equipments: true },
  });
  if (!old) return;
  const mediaIds = [
    old.coverImageId,
    ...old.facadeImageIds,
    old.videoUrl.startsWith("/api/images/") ? old.videoUrl.split("/").pop() : null,
    ...old.recommendations.map((r) => r.imageId),
    ...old.equipments.map((e) => e.imageId),
  ].filter(Boolean) as string[];
  await prisma.livret.delete({ where: { id } });
  if (mediaIds.length) await prisma.image.deleteMany({ where: { id: { in: mediaIds } } });
}

async function main() {
  if (!DRY) {
    const demos = await prisma.livret.findMany({ where: { name: { startsWith: "Démo" } }, select: { id: true, name: true } });
    for (const d of demos) {
      await removeLivret(d.id);
      console.log(`🗑  Livret de démonstration supprimé : ${d.name}`);
    }
  }

  for (const [index, src] of SOURCES.entries()) {
    console.log(`\n→ ${src.name}`);
    const res = await fetch(`${BASE}/livret/b/${src.id}/preview?name=Concierge`);
    if (!res.ok) {
      console.error(`   ✗ impossible de lire le livret (HTTP ${res.status})`);
      continue;
    }
    const parsed = await parseLivret(await res.text());
    const { livret: l } = parsed;
    console.log(
      `   ${l.title} — ${parsed.recos.length} recos, ${parsed.equipments.length} équipements, ` +
        `${parsed.transports.length} transports, ${parsed.contacts.length} contacts, ${parsed.facadeUrls.length} photos devanture` +
        (parsed.videoSrc ? ", 1 vidéo" : ""),
    );

    if (DRY) {
      console.dir(parsed, { depth: 4 });
      continue;
    }

    const existing = await prisma.livret.findFirst({ where: { name: src.name }, select: { id: true, token: true, active: true } });
    if (existing) await removeLivret(existing.id);

    const coverImageId = await importImage(parsed.heroUrl);
    const facadeImageIds = (await Promise.all(parsed.facadeUrls.map(importImage))).filter(Boolean) as string[];
    const videoUrl = await importVideo(parsed.videoSrc);
    const recos = await Promise.all(
      parsed.recos.map(async ({ photo, ...r }) => ({ ...r, imageId: await importImage(photo) })),
    );
    const equipments = await Promise.all(
      parsed.equipments.map(async ({ photo, ...e }) => ({ ...e, imageId: await importImage(photo) })),
    );

    await prisma.livret.create({
      data: {
        ...l,
        name: src.name,
        token: existing?.token ?? generateLivretToken(),
        active: existing?.active ?? true,
        sortOrder: index,
        coverImageId,
        facadeImageIds,
        videoUrl,
        recommendations: { create: recos as never },
        equipments: { create: equipments as never },
        transports: { create: parsed.transports },
        contacts: { create: parsed.contacts },
      },
    });
    console.log(`   ✓ importé${existing ? " (lien conservé)" : ""}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
