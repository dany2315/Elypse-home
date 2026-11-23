/**
 * Calendrier des réservations (vue « Calendrier » des Finances) : module pur, sans accès à la base.
 * Un séjour occupe les nuits de son arrivée (incluse) à son départ (exclu).
 */

/** Séjour confirmé affiché dans le calendrier, avec ses montants pour le séjour entier. */
export type CalendarStay = {
  id: number;
  /** Clé du bien (ou « listing:<id> » pour un listing non regroupé). */
  unit: string;
  unitName: string;
  channel: string;
  guestName: string | null;
  reference: string | null;
  arrival: string;
  departure: string;
  nights: number;
  /** Chiffre d'affaires du séjour (tout ce que le voyageur a payé). */
  gross: number;
  /** Net des plateformes du séjour (avant vos charges). */
  payout: number;
};

export type CalendarData = {
  /** Mois affiché, AAAA-MM. */
  month: string;
  stays: CalendarStay[];
  /** Biens affichés (ordre d'affichage) : une ligne par bien dans chaque jour. */
  units: { key: string; name: string }[];
  /** Tous les biens comptés (et le bien affiché seul) : légende sous le calendrier. */
  legend: { key: string; name: string }[];
};

export type CalendarDay = {
  date: string;
  /** false : jour du mois précédent ou suivant (case vide). */
  inMonth: boolean;
  weekend: boolean;
};

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export const nextMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
};
export const prevMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
};

/** Semaines du mois, du lundi au dimanche (cases des mois voisins pour compléter). */
export function monthWeeks(month: string): CalendarDay[][] {
  const first = `${month}-01`;
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // lundi = 0
  const last = addDays(`${nextMonth(month)}-01`, -1);
  const days: CalendarDay[] = [];
  for (let d = addDays(first, -lead); d <= last || days.length % 7; d = addDays(d, 1)) {
    const dow = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
    days.push({ date: d, inMonth: d.startsWith(month), weekend: dow >= 5 });
  }
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/** Séjour présent la nuit du jour donné (arrivée ≤ jour < départ). */
export const sleepsOn = (s: CalendarStay, day: string) => s.arrival <= day && day < s.departure;

/** Arrivées, séjours en cours et départs d'un jour. */
export function dayActivity(stays: CalendarStay[], day: string) {
  return {
    arrivals: stays.filter((s) => s.arrival === day),
    staying: stays.filter((s) => s.arrival < day && day < s.departure),
    departures: stays.filter((s) => s.departure === day),
    occupied: stays.filter((s) => sleepsOn(s, day)).length,
  };
}

/** Pour un bien et un jour : séjour de la nuit précédente et séjour de la nuit (demi-cases gauche et droite). */
export function laneAt(stays: CalendarStay[], day: string) {
  const before = addDays(day, -1);
  return { previous: stays.find((s) => sleepsOn(s, before)) ?? null, current: stays.find((s) => sleepsOn(s, day)) ?? null };
}

/** Nuits occupées dans le mois et nombre d'arrivées du mois. */
export function monthStats(data: CalendarData) {
  const start = `${data.month}-01`;
  const end = `${nextMonth(data.month)}-01`;
  const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
  let nights = 0;
  for (const s of data.stays) {
    const a = s.arrival > start ? s.arrival : start;
    const b = s.departure < end ? s.departure : end;
    if (b > a) nights += Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
  }
  const available = days * data.units.length;
  return {
    nights,
    available,
    occupancy: available ? nights / available : null,
    arrivals: data.stays.filter((s) => s.arrival >= start && s.arrival < end).length,
  };
}
