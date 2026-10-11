/**
 * Google Places API (New) — sert au script scripts/google-enrich.ts (retrouver
 * la fiche d'un établissement) et à l'affichage des photos, notes et horaires dans le livret.
 * La clé (GOOGLE_MAPS_API_KEY) reste côté serveur : variable secrète Vercel, jamais dans le code ni chez le voyageur.
 */

const API = "https://places.googleapis.com/v1";
const PARIS = { low: { latitude: 48.8, longitude: 2.2 }, high: { latitude: 48.92, longitude: 2.48 } };

function key() {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  if (!k) throw new Error("GOOGLE_MAPS_API_KEY manquante (variable d'environnement)");
  return k;
}

export type PlaceMatch = {
  id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  mapsUri: string;
};

/** Recherche la fiche Google Maps d'un établissement (nom + adresse, limitée à Paris). */
export async function searchPlace(query: string): Promise<PlaceMatch | null> {
  const res = await fetch(`${API}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key(),
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri",
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "fr",
      regionCode: "FR",
      pageSize: 1,
      locationBias: { rectangle: PARIS },
    }),
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}: ${await res.text()}`);
  const place = (await res.json()).places?.[0];
  if (!place) return null;
  return {
    id: place.id,
    name: place.displayName?.text ?? "",
    address: place.formattedAddress ?? "",
    phone: place.nationalPhoneNumber ?? "",
    website: place.websiteUri ?? "",
    mapsUri: place.googleMapsUri ?? "",
  };
}

/** Tranche d'ouverture Google : jour 0 = dimanche. Sans `close`, ouvert 24 h/24. */
export type OpeningPeriod = {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
};

export type PlaceLive = {
  photo: { uri: string; author: string; authorUri: string } | null;
  rating: number | null;
  ratingCount: number | null;
  /** Calcul « ouvert maintenant » fait côté voyageur, pour pouvoir garder la fiche en cache 24 h. */
  periods: OpeningPeriod[];
  hours: string[];
  mapsUri: string;
};

/** Chaque fiche n'est demandée à Google qu'une fois par jour au maximum (quota maîtrisé). */
const CACHE_SECONDS = 24 * 60 * 60;

/** Photo, note et horaires d'une fiche, dans la langue du voyageur. */
export async function getPlaceLive(placeId: string, lang: "fr" | "en"): Promise<PlaceLive> {
  const res = await fetch(`${API}/places/${encodeURIComponent(placeId)}?languageCode=${lang}`, {
    headers: {
      "X-Goog-Api-Key": key(),
      "X-Goog-FieldMask": "photos,rating,userRatingCount,regularOpeningHours,googleMapsUri",
    },
    next: { revalidate: CACHE_SECONDS },
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}`);
  const place = await res.json();

  let photo: PlaceLive["photo"] = null;
  const first = place.photos?.[0];
  if (first?.name) {
    const media = await fetch(`${API}/${first.name}/media?maxWidthPx=1200&skipHttpRedirect=true`, {
      headers: { "X-Goog-Api-Key": key() },
      next: { revalidate: CACHE_SECONDS },
    });
    if (media.ok) {
      const { photoUri } = await media.json();
      const author = first.authorAttributions?.[0];
      if (photoUri) photo = { uri: photoUri, author: author?.displayName ?? "", authorUri: author?.uri ?? "" };
    }
  }

  return {
    photo,
    rating: place.rating ?? null,
    ratingCount: place.userRatingCount ?? null,
    periods: place.regularOpeningHours?.periods ?? [],
    hours: place.regularOpeningHours?.weekdayDescriptions ?? [],
    mapsUri: place.googleMapsUri ?? "",
  };
}
