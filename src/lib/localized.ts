export type Lang = "fr" | "en";
export type Localized = { fr: string; en?: string };

/** Lit un champ JSON bilingue de la base de façon sûre. */
export function asLocalized(value: unknown): Localized {
  if (value && typeof value === "object" && "fr" in value) {
    const v = value as Record<string, unknown>;
    return { fr: String(v.fr ?? ""), en: String(v.en ?? "") };
  }
  return { fr: typeof value === "string" ? value : "", en: "" };
}

/** Texte dans la langue demandée, avec repli sur le français. */
export function t(value: unknown, lang: Lang): string {
  const l = asLocalized(value);
  return (lang === "en" && l.en?.trim() ? l.en : l.fr) ?? "";
}

/** Mémorise la langue choisie par le voyageur (lue côté serveur au prochain chargement). */
export function saveGuestLang(lang: Lang) {
  document.cookie = `elypse-lang=${lang}; path=/; max-age=31536000; samesite=lax`;
}
