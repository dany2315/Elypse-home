"use client";

import { useEffect, useState } from "react";

export type Weather = {
  current: { temp: number; code: number; wind: number };
  days: { date: string; code: number; max: number; min: number; rain: number }[];
};

const ICONS: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️", 56: "🌧️", 57: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️", 66: "🌧️", 67: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "❄️", 77: "❄️",
  80: "🌦️", 81: "🌧️", 82: "⛈️", 85: "🌨️", 86: "❄️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};
export const weatherIcon = (code: number) => ICONS[code] ?? "🌡️";

const LABELS: Record<string, [string, string]> = {
  clear: ["Ensoleillé", "Sunny"],
  partly: ["Éclaircies", "Partly cloudy"],
  cloudy: ["Nuageux", "Cloudy"],
  fog: ["Brouillard", "Foggy"],
  drizzle: ["Bruine", "Drizzle"],
  rain: ["Pluie", "Rain"],
  snow: ["Neige", "Snow"],
  storm: ["Orageux", "Stormy"],
};
export function weatherLabel(code: number, lang: "fr" | "en") {
  const key =
    code === 0 ? "clear"
    : code <= 2 ? "partly"
    : code === 3 ? "cloudy"
    : code <= 48 ? "fog"
    : code <= 57 ? "drizzle"
    : code <= 67 || (code >= 80 && code <= 82) ? "rain"
    : code <= 86 ? "snow"
    : "storm";
  return LABELS[key][lang === "fr" ? 0 : 1];
}

const cache = new Map<string, Promise<Weather | null>>();

async function load(city: string, lat: number | null, lon: number | null): Promise<Weather | null> {
  try {
    let latitude = lat;
    let longitude = lon;
    if (latitude == null || longitude == null) {
      const geo = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city || "Paris")}&count=1&language=fr`,
      ).then((r) => r.json());
      latitude = geo?.results?.[0]?.latitude ?? 48.8566;
      longitude = geo?.results?.[0]?.longitude ?? 2.3522;
    }
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&forecast_days=6`;
    const d = await fetch(url).then((r) => r.json());
    return {
      current: {
        temp: Math.round(d.current.temperature_2m),
        code: d.current.weather_code,
        wind: Math.round(d.current.wind_speed_10m),
      },
      days: (d.daily.time as string[]).map((date, i) => ({
        date,
        code: d.daily.weather_code[i],
        max: Math.round(d.daily.temperature_2m_max[i]),
        min: Math.round(d.daily.temperature_2m_min[i]),
        rain: d.daily.precipitation_probability_max[i] ?? 0,
      })),
    };
  } catch {
    return null;
  }
}

/** Météo via Open-Meteo (gratuit, sans clé API). */
export function useWeather(city: string, lat: number | null, lon: number | null) {
  const [state, setState] = useState<{ data: Weather | null; loading: boolean }>({ data: null, loading: true });
  useEffect(() => {
    const key = `${city}|${lat}|${lon}`;
    if (!cache.has(key)) cache.set(key, load(city, lat, lon));
    let alive = true;
    cache.get(key)!.then((data) => alive && setState({ data, loading: false }));
    return () => {
      alive = false;
    };
  }, [city, lat, lon]);
  return state;
}
