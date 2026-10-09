/** Référentiels partagés entre le dashboard et le livret public. */

type Option = { value: string; icon: string; fr: string; en: string };

export const RECO_CATEGORIES: Option[] = [
  { value: "restaurant", icon: "🍽️", fr: "Restaurants", en: "Restaurants" },
  { value: "boulangerie", icon: "🥐", fr: "Boulangeries", en: "Bakeries" },
  { value: "cafe", icon: "☕", fr: "Cafés", en: "Cafés" },
  { value: "bar", icon: "🍸", fr: "Bars", en: "Bars" },
  { value: "commerce", icon: "🛍️", fr: "Commerces", en: "Shops" },
  { value: "courses", icon: "🛒", fr: "Courses", en: "Groceries" },
  { value: "marche", icon: "🧺", fr: "Marchés", en: "Markets" },
  { value: "culture", icon: "🏛️", fr: "Culture", en: "Culture" },
  { value: "activite", icon: "✨", fr: "Activités", en: "Activities" },
  { value: "balade", icon: "🌿", fr: "Balades", en: "Walks" },
  { value: "plage", icon: "🏖️", fr: "Plages", en: "Beaches" },
  { value: "autre", icon: "📍", fr: "Autres", en: "Other" },
];

export const TRAVEL_MODES: Option[] = [
  { value: "", icon: "", fr: "—", en: "—" },
  { value: "pied", icon: "🚶", fr: "À pied", en: "On foot" },
  { value: "voiture", icon: "🚗", fr: "Voiture", en: "By car" },
  { value: "metro", icon: "🚇", fr: "Métro", en: "Metro" },
  { value: "bateau", icon: "⛴️", fr: "Bateau", en: "Boat" },
];

export const EQUIPMENT_CATEGORIES: Option[] = [
  { value: "cuisine", icon: "☕", fr: "Cuisine", en: "Kitchen" },
  { value: "salon", icon: "📺", fr: "Salon", en: "Living room" },
  { value: "chambre", icon: "🛏️", fr: "Chambre", en: "Bedroom" },
  { value: "salle-de-bain", icon: "🛁", fr: "Salle de bain", en: "Bathroom" },
  { value: "buanderie", icon: "👕", fr: "Buanderie", en: "Laundry" },
  { value: "confort", icon: "🌡️", fr: "Confort", en: "Comfort" },
  { value: "exterieur", icon: "🌿", fr: "Extérieur", en: "Outdoor" },
  { value: "autre", icon: "🔧", fr: "Autre", en: "Other" },
];

export const TRANSPORT_TYPES: Option[] = [
  { value: "metro", icon: "🚇", fr: "Métro", en: "Metro" },
  { value: "rer", icon: "🚆", fr: "RER / Train", en: "RER / Train" },
  { value: "bus", icon: "🚌", fr: "Bus", en: "Bus" },
  { value: "navette", icon: "🚐", fr: "Navette", en: "Shuttle" },
  { value: "taxi", icon: "🚕", fr: "Taxi", en: "Taxi" },
  { value: "location", icon: "🚲", fr: "Location", en: "Rental" },
  { value: "plan", icon: "🗺️", fr: "Plan / lien", en: "Map / link" },
  { value: "autre", icon: "📍", fr: "Autre", en: "Other" },
];

export const CONTACT_TYPES: Option[] = [
  { value: "pharmacie", icon: "💊", fr: "Pharmacie", en: "Pharmacy" },
  { value: "medecin", icon: "🩺", fr: "Médecin", en: "Doctor" },
  { value: "teleconsultation", icon: "🖥️", fr: "Téléconsultation", en: "Teleconsultation" },
  { value: "hopital", icon: "🏥", fr: "Hôpital", en: "Hospital" },
  { value: "dentiste", icon: "🦷", fr: "Dentiste", en: "Dentist" },
  { value: "veterinaire", icon: "🐾", fr: "Vétérinaire", en: "Vet" },
  { value: "autre", icon: "📇", fr: "Autre", en: "Other" },
];

export const ACCESS_TYPES = [
  { value: "", fr: "— Non précisé —", en: "" },
  { value: "boite-a-cle", fr: "Boîte à clé", en: "Key box" },
  { value: "keynest", fr: "KeyNest", en: "KeyNest" },
  { value: "serrure-connectee", fr: "Serrure connectée", en: "Smart lock" },
  { value: "main-propre", fr: "Remise en main propre", en: "In-person handover" },
  { value: "autre", fr: "Autre", en: "Other" },
];

export const EMERGENCY_NUMBERS = [
  { number: "15", icon: "🏥", fr: "SAMU — urgences médicales", en: "SAMU — medical emergencies" },
  { number: "18", icon: "🚒", fr: "Pompiers", en: "Fire brigade" },
  { number: "17", icon: "👮", fr: "Police", en: "Police" },
  { number: "112", icon: "🆘", fr: "Urgences européennes", en: "European emergency" },
];

export function findOption<T extends { value: string }>(list: T[], value: string): T {
  return list.find((o) => o.value === value) ?? list[list.length - 1];
}
