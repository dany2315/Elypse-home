/**
 * Google Places API (New) — utilisée uniquement par scripts/google-enrich.ts pour retrouver
 * la fiche d'un établissement (identifiant, téléphone, site, adresse).
 * La clé est fournie au moment de lancer le script : elle ne reste pas dans le projet.
 */

const API = "https://places.googleapis.com/v1";
const PARIS = { low: { latitude: 48.8, longitude: 2.2 }, high: { latitude: 48.92, longitude: 2.48 } };

function key() {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  if (!k) throw new Error("GOOGLE_MAPS_API_KEY manquante : la fournir au lancement du script");
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
