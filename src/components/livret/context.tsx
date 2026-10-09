"use client";

import { createContext, useContext } from "react";
import type { ContactItem, EquipmentItem, LivretForm, RecoItem, TransportItem } from "@/lib/livret-data";
import { t as pick, type Lang } from "@/lib/localized";
import { type I18nKey, translator } from "./i18n";

export type GuestData = {
  token: string;
  livret: Omit<LivretForm, "name" | "active">;
  recommendations: RecoItem[];
  equipments: EquipmentItem[];
  transports: TransportItem[];
  contacts: ContactItem[];
};

type Ctx = {
  data: GuestData;
  lang: Lang;
  /** Libellé d'interface traduit. */
  tr: (key: I18nKey) => string;
  /** Contenu bilingue saisi dans le dashboard. */
  loc: (value: unknown) => string;
  openImage: (src: string) => void;
};

const LivretContext = createContext<Ctx | null>(null);

export function LivretProvider({
  data,
  lang,
  openImage,
  children,
}: {
  data: GuestData;
  lang: Lang;
  openImage: (src: string) => void;
  children: React.ReactNode;
}) {
  return (
    <LivretContext.Provider
      value={{ data, lang, tr: translator(lang), loc: (v) => pick(v, lang), openImage }}
    >
      {children}
    </LivretContext.Provider>
  );
}

export function useLivret() {
  const ctx = useContext(LivretContext);
  if (!ctx) throw new Error("useLivret hors de LivretProvider");
  return ctx;
}
