/**
 * Google Places API (New) — appelée uniquement côté serveur (la clé ne quitte jamais le serveur).
 * Seul l'identifiant de fiche (place ID) est conservé en base ; photo, note et horaires
 * sont lus chez Google et gardés en cache quelques heures seulement.
 */

const API = "https://places.googleapis.com/v1";
const PARIS = { low: { latitude: 48.8, longitude: 2.2 }, high: { latitude: 48.92, longitude: 2.48 } };

function key() {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  if (!k) throw new Error("GOOGLE_MAPS_API_KEY manquante dans .env");
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

export type PlaceLive = {
  photo: { uri: string; author: string; authorUri: string } | null;
  rating: number | null;
  ratingCount: number | null;
  openNow: boolean | null;
  hours: string[];
  mapsUri: string;
};

/** « Ouvert maintenant » doit rester à jour ; la photo, elle, change rarement. */
const DETAILS_CACHE_SECONDS = 30 * 60;
const PHOTO_CACHE_SECONDS = 6 * 60 * 60;

/** Photo, note et horaires d'une fiche, dans la langue du voyageur. */
export async function getPlaceLive(placeId: string, lang: "fr" | "en"): Promise<PlaceLive> {
  const res = await fetch(`${API}/places/${encodeURIComponent(placeId)}?languageCode=${lang}`, {
    headers: {
      "X-Goog-Api-Key": key(),
      "X-Goog-FieldMask":
        "photos,rating,userRatingCount,currentOpeningHours.openNow,regularOpeningHours.weekdayDescriptions,googleMapsUri",
    },
    next: { revalidate: DETAILS_CACHE_SECONDS },
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}`);
  const place = await res.json();

  let photo: PlaceLive["photo"] = null;
  const first = place.photos?.[0];
  if (first?.name) {
    const media = await fetch(`${API}/${first.name}/media?maxWidthPx=1200&skipHttpRedirect=true`, {
      headers: { "X-Goog-Api-Key": key() },
      next: { revalidate: PHOTO_CACHE_SECONDS },
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
    openNow: place.currentOpeningHours?.openNow ?? null,
    hours: place.regularOpeningHours?.weekdayDescriptions ?? [],
    mapsUri: place.googleMapsUri ?? "",
  };
}
