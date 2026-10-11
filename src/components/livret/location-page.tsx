"use client";

import { ArrowRight, BookOpen, Clock, MapPin, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { imageUrl } from "@/lib/image-url";
import { t as pick, type Lang, type Localized, saveGuestLang } from "@/lib/localized";
import { cn } from "@/lib/utils";
import { CopyButton, NavButtons, Prose } from "./ui";

const TEXT = {
  eyebrow: { fr: "Votre adresse", en: "Your address" },
  arrival: { fr: "Arrivée dès", en: "Check-in from" },
  copy: { fr: "Copier l'adresse", en: "Copy address" },
  copied: { fr: "Copiée", en: "Copied" },
  guideTitle: { fr: "Votre livret d'accueil", en: "Your welcome guide" },
  guideText: {
    fr: "Accès, codes, wifi, équipements, nos adresses du quartier… tout votre séjour au même endroit.",
    en: "Access, codes, Wi-Fi, amenities, our favourite local spots… your whole stay in one place.",
  },
  open: { fr: "Ouvrir le livret", en: "Open the guide" },
  photo: { fr: "Photo", en: "Photo" },
} satisfies Record<string, Record<Lang, string>>;

export type LocationData = {
  title: string;
  address: string;
  city: string;
  checkinTime: string;
  photoIds: string[];
  note: Localized;
};

export function LocationPage({
  data,
  livretHref,
  initialLang,
}: {
  data: LocationData;
  livretHref: string;
  initialLang: Lang;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [slide, setSlide] = useState(0);
  const [zoom, setZoom] = useState<string | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const tr = (k: keyof typeof TEXT) => TEXT[k][lang];
  const address = [data.address, data.city].filter(Boolean).join(", ");
  const note = pick(data.note, lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function changeLang(next: Lang) {
    setLang(next);
    saveGuestLang(next);
  }

  function onScroll() {
    const el = track.current;
    if (el) setSlide(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div className="min-h-dvh bg-night lg:py-10">
      <div className="relative mx-auto min-h-dvh max-w-[480px] overflow-hidden bg-ivory lg:min-h-[calc(100dvh-5rem)] lg:rounded-[2.5rem] lg:shadow-[0_40px_120px_-30px_rgba(0,0,0,.8)] lg:ring-1 lg:ring-gold/20">
        {/* Photos de l'emplacement */}
        <header className="relative h-[62svh] min-h-[420px] overflow-hidden bg-night">
          {data.photoIds.length > 0 ? (
            <div
              ref={track}
              onScroll={onScroll}
              className="scrollbar-none flex h-full snap-x snap-mandatory overflow-x-auto"
            >
              {data.photoIds.map((id, i) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setZoom(imageUrl(id))}
                  className="relative h-full w-full shrink-0 snap-center"
                  aria-label={`${tr("photo")} ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl(id)!}
                    alt=""
                    loading={i === 0 ? "eager" : "lazy"}
                    className="size-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_50%_10%,#1d2656,#070c1c_65%)]">
              <Image src="/brand/monogram.png" alt="" width={513} height={638} className="h-auto w-36 opacity-[0.15]" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,28,.55)_0%,rgba(7,12,28,0)_28%,rgba(7,12,28,0)_70%,rgba(7,12,28,.6)_100%)]" />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
            <Image src="/brand/monogram.png" alt="Elypse Home" width={513} height={638} priority className="h-auto w-9 drop-shadow-lg" />
            <div className="flex h-9 rounded-full border border-white/15 bg-night/30 p-0.5 backdrop-blur-md" role="group" aria-label="Langue">
              {(["fr", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => changeLang(code)}
                  aria-pressed={lang === code}
                  className={cn(
                    "rounded-full px-3 text-[11px] font-bold tracking-[0.12em] uppercase transition",
                    lang === code ? "bg-gold-foil text-night" : "text-ivory/70",
                  )}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          {data.photoIds.length > 1 && (
            <div className="absolute inset-x-0 bottom-12 flex justify-center gap-1.5">
              {data.photoIds.map((id, i) => (
                <span
                  key={id}
                  className={cn("h-1.5 rounded-full transition-all", i === slide ? "w-5 bg-gold-light" : "w-1.5 bg-white/60")}
                />
              ))}
            </div>
          )}
        </header>

        {/* Adresse */}
        <main className="relative z-10 -mt-7 space-y-7 rounded-t-[2rem] bg-ivory px-5 pt-8 pb-12">
          <div className="animate-rise">
            <p className="text-[10.5px] font-semibold tracking-[0.3em] text-gold-deep uppercase">✦ {tr("eyebrow")}</p>
            <h1 className="mt-2 font-serif text-[2.2rem] leading-[1.05] text-ink">{data.title}</h1>
            {address && (
              <p className="mt-3 flex items-start gap-2 text-[15px] text-ink/75">
                <MapPin className="mt-0.5 size-4 shrink-0 text-gold-deep" /> {address}
              </p>
            )}
            {data.checkinTime && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-ink/80">
                <Clock className="size-3.5 text-gold-deep" /> {tr("arrival")} {data.checkinTime}
              </p>
            )}
          </div>

          {note && <Prose text={note} />}

          {address && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-[1.6rem] border border-[#ebe3d3] bg-white">
                <iframe
                  title="Carte"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=16&output=embed`}
                  className="h-52 w-full border-0 grayscale-[35%]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <NavButtons query={address} />
              <CopyButton value={address} label={tr("copy")} copiedLabel={tr("copied")} className="w-full" />
            </div>
          )}

          {/* Accès au livret */}
          <Link
            href={livretHref}
            className="group relative block overflow-hidden rounded-[1.8rem] bg-night p-6 text-ivory"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,#2a3470,transparent_60%)]" />
            <div className="grain absolute inset-0" />
            <BookOpen className="relative size-7 text-gold-light" strokeWidth={1.3} />
            <p className="relative mt-6 font-serif text-[1.9rem] leading-tight">{tr("guideTitle")}</p>
            <p className="relative mt-2 text-sm leading-relaxed text-ivory/70">{tr("guideText")}</p>
            <span className="bg-gold-foil relative mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[13px] font-bold tracking-[0.12em] text-night uppercase transition group-active:scale-[0.98]">
              {tr("open")} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>

          <footer className="flex flex-col items-center pt-2 text-center">
            <Image src="/brand/monogram.png" alt="" width={513} height={638} className="h-auto w-10 [filter:brightness(.8)_saturate(1.2)]" />
            <p className="mt-3 font-serif text-base tracking-[0.2em] text-ink uppercase">Elypse Home</p>
            <p className="mt-1 text-[10px] tracking-[0.4em] text-gold-deep uppercase">Paris · Luxury apartments</p>
          </footer>
        </main>

        {zoom && (
          <button
            type="button"
            onClick={() => setZoom(null)}
            className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-night/95 p-4 duration-200"
            aria-label="Fermer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
            <span className="absolute top-5 right-5 flex size-10 items-center justify-center rounded-full bg-white/10 text-ivory">
              <X className="size-5" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
