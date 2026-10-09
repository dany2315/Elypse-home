"use client";

import {
  ArrowLeft,
  Bus,
  Car,
  ChevronRight,
  CloudSun,
  DoorOpen,
  KeyRound,
  LifeBuoy,
  type LucideIcon,
  Phone,
  ScrollText,
  Sofa,
  UtensilsCrossed,
  Wifi,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Lang } from "@/lib/localized";
import { imageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";
import { type GuestData, LivretProvider, useLivret } from "./context";
import type { I18nKey } from "./i18n";
import {
  AccessPage,
  ArrivalPage,
  AssistancePage,
  DeparturePage,
  EquipmentPage,
  RecosPage,
  RulesPage,
  TransportPage,
  WeatherPage,
  WifiPage,
} from "./pages";
import { telUrl } from "./ui";
import { useWeather, weatherIcon } from "./use-weather";

type PageId =
  | "arrivee"
  | "wifi"
  | "depart"
  | "equipements"
  | "regles"
  | "acces"
  | "adresses"
  | "transports"
  | "meteo"
  | "assistance";

const PAGES: Record<PageId, { title: I18nKey; eyebrow: I18nKey; icon: LucideIcon; Component: React.FC }> = {
  arrivee: { title: "arrival", eyebrow: "arrivalHint", icon: KeyRound, Component: ArrivalPage },
  wifi: { title: "wifi", eyebrow: "network", icon: Wifi, Component: WifiPage },
  depart: { title: "departure", eyebrow: "beforeLeaving", icon: DoorOpen, Component: DeparturePage },
  equipements: { title: "equipment", eyebrow: "equipmentHint", icon: Sofa, Component: EquipmentPage },
  regles: { title: "rules", eyebrow: "rulesHint", icon: ScrollText, Component: RulesPage },
  acces: { title: "access", eyebrow: "accessHint", icon: Car, Component: AccessPage },
  adresses: { title: "recos", eyebrow: "recosHint", icon: UtensilsCrossed, Component: RecosPage },
  transports: { title: "transport", eyebrow: "transportHint", icon: Bus, Component: TransportPage },
  meteo: { title: "weather", eyebrow: "weatherHint", icon: CloudSun, Component: WeatherPage },
  assistance: { title: "assistance", eyebrow: "assistanceHint", icon: LifeBuoy, Component: AssistancePage },
};

const isPage = (v: string): v is PageId => v in PAGES;

// Page ouverte = ancre de l'URL (#wifi…) : le bouton « retour » du téléphone ferme la page.
const subscribeHash = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
};
const readHash = () => window.location.hash.slice(1);
const notifyHash = () => window.dispatchEvent(new PopStateEvent("popstate"));

export function GuestLivret({ data, initialLang }: { data: GuestData; initialLang: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [image, setImage] = useState<string | null>(null);
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const page = isPage(hash) ? hash : null;
  const overlay = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function changeLang(next: Lang) {
    setLang(next);
    document.cookie = `elypse-lang=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  const open = useCallback((id: PageId) => {
    window.history.pushState({ livretPage: true }, "", `#${id}`);
    notifyHash();
  }, []);
  const close = useCallback(() => {
    // Page ouverte depuis l'accueil : on revient dans l'historique. Lien direct (#wifi) : on nettoie l'URL.
    if (window.history.state?.livretPage) window.history.back();
    else {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      notifyHash();
    }
  }, []);

  useEffect(() => {
    if (page) overlay.current?.scrollTo({ top: 0 });
  }, [page]);

  useEffect(() => {
    document.body.style.overflow = page || image ? "hidden" : "";
  }, [page, image]);

  return (
    <LivretProvider data={data} lang={lang} openImage={setImage}>
      <div className="min-h-dvh bg-night lg:py-10">
        <div className="relative mx-auto min-h-dvh max-w-[480px] overflow-hidden bg-ivory lg:min-h-[calc(100dvh-5rem)] lg:rounded-[2.5rem] lg:shadow-[0_40px_120px_-30px_rgba(0,0,0,.8)] lg:ring-1 lg:ring-gold/20">
          <Home lang={lang} onLang={changeLang} onOpen={open} />

          {/* Sous-page */}
          <div
            ref={overlay}
            className={cn(
              "fixed inset-0 z-30 mx-auto max-w-[480px] overflow-y-auto overscroll-contain bg-ivory transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)]",
              page ? "translate-x-0" : "pointer-events-none translate-x-full",
            )}
            aria-hidden={!page}
          >
            {page && <SubPage id={page} onBack={close} />}
          </div>

          {image && (
            <button
              type="button"
              onClick={() => setImage(null)}
              className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-night/95 p-4 duration-200"
              aria-label="Fermer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
              <span className="absolute top-5 right-5 flex size-10 items-center justify-center rounded-full bg-white/10 text-ivory">
                <X className="size-5" />
              </span>
            </button>
          )}
        </div>
      </div>
    </LivretProvider>
  );
}

/* ---------------------------------- Accueil ---------------------------------- */

function Home({ lang, onLang, onOpen }: { lang: Lang; onLang: (l: Lang) => void; onOpen: (id: PageId) => void }) {
  const { data, tr, loc } = useLivret();
  const l = data.livret;
  const { data: weather } = useWeather(l.city, l.latitude, l.longitude);
  const cover = imageUrl(l.coverImageId);

  // La barre passe en « ivoire » quand le bas de la photo sort de l'écran.
  const sentinel = useRef<HTMLDivElement>(null);
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setSolid(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const has = {
    equipements: data.equipments.length > 0 || Boolean(loc(l.essentials)),
    regles: Boolean(loc(l.rules)),
    acces: Boolean(l.address || loc(l.parking)),
    adresses: data.recommendations.length > 0,
    transports: data.transports.length > 0,
  };

  const stay: PageId[] = (["equipements", "regles", "acces"] as const).filter((p) => has[p]);
  const discover: PageId[] = (["adresses", "transports", "meteo"] as const).filter((p) => p === "meteo" || has[p]);

  return (
    <div className="pb-safe">
      {/* Barre fixe : logo, météo, langue */}
      <div
        className={cn(
          "fixed inset-x-0 top-0 z-20 mx-auto max-w-[480px] transition-[background-color,box-shadow,backdrop-filter] duration-500",
          solid
            ? "bg-ivory/80 shadow-[0_12px_30px_-24px_rgba(18,22,42,.45)] backdrop-blur-xl backdrop-saturate-150"
            : "bg-gradient-to-b from-night/45 to-transparent",
        )}
      >
        <div className="flex items-center gap-3 px-5 pt-[max(.9rem,env(safe-area-inset-top))] pb-3">
          <Image
            src="/brand/monogram.png"
            alt="Elypse Home"
            width={513}
            height={638}
            priority
            className={cn("h-auto shrink-0 transition-all duration-500", solid ? "w-7" : "w-9 drop-shadow-lg")}
          />
          <p
            className={cn(
              "min-w-0 flex-1 truncate font-serif text-[1.05rem] text-ink transition-all duration-500",
              solid ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0",
            )}
          >
            {l.title}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {weather && (
              <button
                type="button"
                onClick={() => onOpen("meteo")}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold backdrop-blur-md transition-colors duration-500",
                  solid ? "border-[#e3d9c6] bg-white/70 text-ink" : "border-white/15 bg-night/30 text-ivory",
                )}
              >
                <span>{weatherIcon(weather.current.code)}</span>
                {weather.current.temp}°
              </button>
            )}
            <div
              className={cn(
                "flex h-9 rounded-full border p-0.5 backdrop-blur-md transition-colors duration-500",
                solid ? "border-[#e3d9c6] bg-white/70" : "border-white/15 bg-night/30",
              )}
              role="group"
              aria-label="Langue"
            >
              {(["fr", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onLang(code)}
                  aria-pressed={lang === code}
                  className={cn(
                    "rounded-full px-3 text-[11px] font-bold tracking-[0.12em] uppercase transition",
                    lang === code ? "bg-gold-foil text-night" : solid ? "text-ink/60" : "text-ivory/70",
                  )}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={cn("gold-hairline h-px transition-opacity duration-500", solid ? "opacity-40" : "opacity-0")} />
      </div>

      {/* Hero */}
      <header className="relative flex min-h-[66svh] flex-col justify-between overflow-hidden bg-night text-ivory">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="animate-in fade-in zoom-in-105 absolute inset-0 size-full object-cover duration-[1.6s]" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_10%,#1d2656,#070c1c_65%)]">
            <Image src="/brand/monogram.png" alt="" width={513} height={638} className="mb-24 h-auto w-40 opacity-[0.13]" />
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,28,.55)_0%,rgba(7,12,28,.05)_30%,rgba(7,12,28,.35)_55%,#070c1c_100%)]" />
        <div className="grain absolute inset-0" />

        {/* Repère : la barre du haut change de style une fois la photo dépassée */}
        <div ref={sentinel} aria-hidden className="pointer-events-none absolute inset-x-0 bottom-16 h-px" />

        <div className="relative h-[calc(4.25rem+env(safe-area-inset-top))]" />

        <div className="relative px-6 pt-24 pb-14">
          <p className="animate-rise text-[11px] font-semibold tracking-[0.35em] text-gold-light uppercase">
            ✦ {tr("welcome")}
          </p>
          <h1 className="animate-rise mt-3 font-serif text-[2.55rem] leading-[1.02] font-medium text-ivory [animation-delay:80ms]">
            {l.title}
          </h1>
          <div className="animate-rise mt-5 flex items-center gap-3 [animation-delay:160ms]">
            <span className="gold-hairline h-px w-10" />
            <span className="text-[11px] font-semibold tracking-[0.4em] text-ivory/80 uppercase">{l.city}</span>
          </div>
        </div>
      </header>

      {/* Corps */}
      <main className="relative z-10 -mt-7 space-y-9 rounded-t-[2rem] bg-ivory px-5 pt-7">
        {/* L'essentiel */}
        <section>
          <SectionTitle>{tr("essentials")}</SectionTitle>
          <div className="grid grid-cols-3 gap-2.5">
            <KeyTile icon={KeyRound} label={tr("arrival")} value={`${tr("from")} ${l.checkinTime}`} onClick={() => onOpen("arrivee")} />
            {l.wifiSsid ? (
              <KeyTile icon={Wifi} label={tr("wifi")} value={l.wifiSsid} onClick={() => onOpen("wifi")} />
            ) : (
              <KeyTile icon={LifeBuoy} label={tr("assistance")} value={l.contactName} onClick={() => onOpen("assistance")} />
            )}
            <KeyTile icon={DoorOpen} label={tr("departure")} value={`${tr("before")} ${l.checkoutTime}`} onClick={() => onOpen("depart")} />
          </div>
        </section>

        {stay.length > 0 && (
          <section>
            <SectionTitle>{tr("yourStay")}</SectionTitle>
            <div className="overflow-hidden rounded-[1.6rem] border border-[#ebe3d3] bg-white">
              {stay.map((id, i) => (
                <ListRow key={id} id={id} first={i === 0} onClick={() => onOpen(id)} />
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionTitle>{tr("discover")}</SectionTitle>
          {has.adresses && (
            <button
              type="button"
              onClick={() => onOpen("adresses")}
              className="group relative mb-3 flex w-full flex-col justify-end overflow-hidden rounded-[1.8rem] bg-night p-6 text-left text-ivory"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,#2a3470,transparent_60%)]" />
              <div className="grain absolute inset-0" />
              <UtensilsCrossed className="relative mb-10 size-7 text-gold-light" strokeWidth={1.3} />
              <p className="relative text-[10.5px] font-semibold tracking-[0.3em] text-gold-light/80 uppercase">
                {data.recommendations.length} {tr("recosCount")}
              </p>
              <p className="relative mt-1 font-serif text-[2rem] leading-tight">{tr("recos")}</p>
              <ChevronRight className="absolute right-6 bottom-7 size-5 text-gold-light transition group-active:translate-x-1" />
            </button>
          )}
          <div className="overflow-hidden rounded-[1.6rem] border border-[#ebe3d3] bg-white">
            {discover
              .filter((id) => id !== "adresses")
              .map((id, i) => (
                <ListRow key={id} id={id} first={i === 0} onClick={() => onOpen(id)} />
              ))}
          </div>
        </section>

        {/* Assistance */}
        <section>
          <SectionTitle>{tr("help")}</SectionTitle>
          <div className="flex items-center gap-3 rounded-[1.6rem] border border-[#ebe3d3] bg-white p-3 pl-5">
            <button type="button" onClick={() => onOpen("assistance")} className="min-w-0 flex-1 text-left">
              <p className="font-serif text-xl text-ink">{l.contactName}</p>
              <p className="truncate text-xs text-stone">{tr("assistanceHint")}</p>
            </button>
            {l.contactPhone && (
              <a
                href={telUrl(l.contactPhone)}
                className="bg-gold-foil flex h-12 items-center gap-2 rounded-full px-5 text-[13px] font-bold text-night"
              >
                <Phone className="size-4" /> {tr("call")}
              </a>
            )}
          </div>
        </section>

        <footer className="flex flex-col items-center pt-4 pb-10 text-center">
          <Image src="/brand/monogram.png" alt="" width={513} height={638} className="h-auto w-11 [filter:brightness(.8)_saturate(1.2)]" />
          <p className="mt-4 font-serif text-lg tracking-[0.2em] text-ink uppercase">{l.footerText || "Elypse Home"}</p>
          <p className="mt-1 text-[10px] tracking-[0.4em] text-gold-deep uppercase">Paris · Luxury apartments</p>
        </footer>
      </main>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="font-serif text-[1.55rem] leading-none text-ink">{children}</h2>
      <span className="h-px flex-1 bg-gradient-to-r from-gold/50 to-transparent" />
    </div>
  );
}

function KeyTile({ icon: Icon, label, value, onClick }: { icon: LucideIcon; label: string; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-[4/5] flex-col justify-between rounded-[1.4rem] border border-[#ebe3d3] bg-white p-3.5 text-left shadow-[0_18px_40px_-30px_rgba(18,22,42,.45)] transition active:scale-[0.97]"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-night">
        <Icon className="size-[18px] text-gold-light" strokeWidth={1.6} />
      </span>
      <span className="min-w-0">
        <span className="block font-serif text-[1.2rem] leading-tight text-ink">{label}</span>
        <span className="mt-0.5 block truncate text-[11px] font-medium text-stone">{value}</span>
      </span>
    </button>
  );
}

function ListRow({ id, first, onClick }: { id: PageId; first: boolean; onClick: () => void }) {
  const { tr } = useLivret();
  const p = PAGES[id];
  const Icon = p.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex w-full items-center gap-4 px-4 py-4 text-left transition active:bg-accent/60", !first && "border-t border-[#f0e9db]")}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-[#faf6ee]">
        <Icon className="size-[18px] text-gold-deep" strokeWidth={1.6} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-semibold text-ink">{tr(p.title)}</span>
        <span className="block truncate text-xs text-stone">{tr(p.eyebrow)}</span>
      </span>
      <ChevronRight className="size-4 text-gold" />
    </button>
  );
}

/* --------------------------------- Sous-page --------------------------------- */

function SubPage({ id, onBack }: { id: PageId; onBack: () => void }) {
  const { tr } = useLivret();
  const { title, eyebrow, icon: Icon, Component } = PAGES[id];
  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-20 border-b border-[#ebe3d3]/70 bg-ivory/90 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 pt-[max(.9rem,env(safe-area-inset-top))] pb-3.5">
          <button
            type="button"
            onClick={onBack}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e3d9c6] bg-white text-ink transition active:scale-95"
            aria-label={tr("back")}
          >
            <ArrowLeft className="size-[18px]" />
          </button>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.25em] text-gold-deep uppercase">
              <Icon className="size-3" /> {tr(eyebrow)}
            </p>
            <h2 className="truncate font-serif text-[1.65rem] leading-tight text-ink">{tr(title)}</h2>
          </div>
        </div>
      </div>
      <div key={id} className="animate-in fade-in slide-in-from-bottom-2 px-5 pt-6 pb-16 duration-500">
        <Component />
      </div>
    </div>
  );
}

