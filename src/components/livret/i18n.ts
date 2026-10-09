import type { Lang } from "@/lib/localized";

const dict = {
  welcome: { fr: "Bienvenue", en: "Welcome" },
  essentials: { fr: "L'essentiel", en: "The essentials" },
  yourStay: { fr: "Votre séjour", en: "Your stay" },
  discover: { fr: "Découvrir", en: "Explore" },
  help: { fr: "Besoin d'aide ?", en: "Need help?" },

  arrival: { fr: "Arrivée", en: "Arrival" },
  arrivalHint: { fr: "Accès & clés", en: "Access & keys" },
  from: { fr: "Dès", en: "From" },
  before: { fr: "Avant", en: "Before" },
  wifi: { fr: "Wifi", en: "Wi-Fi" },
  departure: { fr: "Départ", en: "Departure" },
  equipment: { fr: "Équipements", en: "Amenities" },
  equipmentHint: { fr: "Modes d'emploi", en: "How-to guides" },
  rules: { fr: "Règles de la maison", en: "House rules" },
  rulesHint: { fr: "Pour un séjour serein", en: "For a peaceful stay" },
  access: { fr: "Adresse & parking", en: "Address & parking" },
  accessHint: { fr: "Itinéraire, stationnement", en: "Directions, parking" },
  recos: { fr: "Nos adresses", en: "Our favourite spots" },
  recosCount: { fr: "adresses sélectionnées", en: "hand-picked spots" },
  recosHint: { fr: "Restaurants, cafés, sorties", en: "Restaurants, cafés, outings" },
  transport: { fr: "Transports", en: "Getting around" },
  transportHint: { fr: "Métro, RER, bus", en: "Metro, RER, bus" },
  weather: { fr: "Météo", en: "Weather" },
  weatherHint: { fr: "Prévisions sur 5 jours", en: "5-day forecast" },
  assistance: { fr: "Assistance", en: "Assistance" },
  assistanceHint: { fr: "Nous sommes joignables", en: "We're here for you" },

  back: { fr: "Retour", en: "Back" },
  copy: { fr: "Copier", en: "Copy" },
  copied: { fr: "Copié", en: "Copied" },
  checkinTime: { fr: "Arrivée à partir de", en: "Check-in from" },
  checkoutTime: { fr: "Départ avant", en: "Check-out before" },
  stepAddress: { fr: "Rejoindre l'adresse", en: "Find the address" },
  doorCode: { fr: "Code de l'immeuble", en: "Building door code" },
  stepParking: { fr: "Se garer", en: "Parking" },
  stepKeys: { fr: "Récupérer les clés", en: "Collect the keys" },
  keyboxCode: { fr: "Code de la boîte à clés", en: "Key box code" },
  stepWelcome: { fr: "Bienvenue chez vous", en: "Welcome home" },
  welcomeDefault: {
    fr: "Installez-vous et faites comme chez vous. Pour toute question, nous sommes à votre disposition.",
    en: "Settle in and make yourself at home. For any question, we're at your disposal.",
  },
  facade: { fr: "Vous êtes au bon endroit", en: "You're in the right place" },
  video: { fr: "Voir la vidéo du trajet", en: "Watch the route video" },

  network: { fr: "Réseau", en: "Network" },
  password: { fr: "Mot de passe", en: "Password" },
  copyPassword: { fr: "Copier le mot de passe", en: "Copy password" },
  scanQr: {
    fr: "Scannez ce code avec l'appareil photo pour vous connecter automatiquement.",
    en: "Scan this code with your camera to connect automatically.",
  },

  provided: { fr: "Fournis pour votre séjour", en: "Provided for your stay" },
  tip: { fr: "Astuce", en: "Tip" },
  warning: { fr: "Important", en: "Important" },

  fullAddress: { fr: "Adresse", en: "Address" },
  parking: { fr: "Stationnement", en: "Parking" },
  maps: { fr: "Google Maps", en: "Google Maps" },
  waze: { fr: "Waze", en: "Waze" },
  directions: { fr: "Itinéraire", en: "Directions" },
  call: { fr: "Appeler", en: "Call" },
  book: { fr: "Réserver", en: "Book" },
  website: { fr: "Site web", en: "Website" },
  all: { fr: "Tout", en: "All" },
  line: { fr: "Ligne", en: "Line" },
  open: { fr: "Ouvrir", en: "Open" },

  now: { fr: "Maintenant", en: "Now" },
  max: { fr: "Max", en: "High" },
  min: { fr: "Min", en: "Low" },
  rain: { fr: "Pluie", en: "Rain" },
  wind: { fr: "Vent", en: "Wind" },
  weatherError: { fr: "Météo momentanément indisponible.", en: "Weather temporarily unavailable." },

  beforeLeaving: { fr: "Avant de partir", en: "Before you leave" },
  checklistHint: { fr: "Touchez chaque étape une fois faite.", en: "Tap each step once done." },
  thanks: { fr: "Merci pour votre séjour", en: "Thank you for staying with us" },
  thanksText: {
    fr: "Ce fut un plaisir de vous accueillir. Un avis nous aide énormément.",
    en: "It was a pleasure hosting you. A review helps us enormously.",
  },

  host: { fr: "Votre conciergerie", en: "Your concierge" },
  sms: { fr: "SMS", en: "Text" },
  whatsapp: { fr: "WhatsApp", en: "WhatsApp" },
  email: { fr: "Email", en: "Email" },
  usefulContacts: { fr: "Contacts utiles", en: "Useful contacts" },
  emergency: { fr: "Urgences", en: "Emergencies" },

  unavailableTitle: { fr: "Livret indisponible", en: "Guidebook unavailable" },
  unavailableText: {
    fr: "Ce lien n'est plus actif. Contactez votre hôte pour obtenir le nouveau lien.",
    en: "This link is no longer active. Please contact your host for the new link.",
  },
} satisfies Record<string, Record<Lang, string>>;

export type I18nKey = keyof typeof dict;

export function translator(lang: Lang) {
  return (key: I18nKey) => dict[key][lang];
}
