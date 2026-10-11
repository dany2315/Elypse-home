"use client";

import { ChevronDown, Clock, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PlaceLive } from "@/lib/google-places";
import type { Lang } from "@/lib/localized";
import { cn } from "@/lib/utils";

const T = {
  open: { fr: "Ouvert", en: "Open now" },
  closed: { fr: "Fermé", en: "Closed" },
  hours: { fr: "Horaires", en: "Opening hours" },
  reviews: { fr: "avis", en: "reviews" },
} satisfies Record<string, Record<Lang, string>>;

/** Charge la fiche Google seulement quand la carte approche de l'écran (économise le quota). */
function usePlace(placeId: string, lang: Lang) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<PlaceLive | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    fetch(`/api/places/${encodeURIComponent(placeId)}?lang=${lang}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [visible, placeId, lang]);

  return { ref, data };
}

/** Photo Google Maps (avec crédit de l'auteur) + note, ouverture et horaires. */
export function GooglePlace({
  placeId,
  lang,
  alt,
  showPhoto,
  onOpenImage,
  children,
}: {
  placeId: string;
  lang: Lang;
  alt: string;
  showPhoto: boolean;
  onOpenImage: (src: string) => void;
  children: React.ReactNode;
}) {
  const { ref, data } = usePlace(placeId, lang);
  const [hoursOpen, setHoursOpen] = useState(false);
  const photo = showPhoto ? data?.photo : null;

  return (
    <div ref={ref}>
      {showPhoto && (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-sand">
          {photo ? (
            <>
              <button type="button" onClick={() => onOpenImage(photo.uri)} className="block size-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.uri} alt={alt} loading="lazy" className="animate-in fade-in size-full object-cover duration-500" />
              </button>
              <span className="absolute right-2 bottom-2 max-w-[85%] truncate rounded-full bg-night/45 px-2 py-0.5 text-[9.5px] text-ivory/85 backdrop-blur-sm">
                {photo.author ? (
                  <a href={photo.authorUri || undefined} target="_blank" rel="noreferrer">
                    © {photo.author}
                  </a>
                ) : null}
                {photo.author ? " · " : ""}Google Maps
              </span>
            </>
          ) : (
            <div className="size-full animate-pulse bg-[linear-gradient(110deg,#efe7d8,#f7f1e6,#efe7d8)]" />
          )}
        </div>
      )}

      {children}

      {data && (data.rating || data.openNow !== null || data.hours.length > 0) && (
        <div className="px-5 pb-5">
          <div className="flex flex-wrap items-center gap-2 border-t border-[#f0e9db] pt-3.5 text-[12.5px]">
            {data.rating ? (
              <span className="inline-flex items-center gap-1 font-semibold text-ink">
                <Star className="size-3.5 fill-gold text-gold" /> {data.rating.toFixed(1).replace(".", lang === "fr" ? "," : ".")}
                {data.ratingCount ? (
                  <span className="font-normal text-stone">
                    ({data.ratingCount.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} {T.reviews[lang]})
                  </span>
                ) : null}
              </span>
            ) : null}
            {data.openNow !== null && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  data.openNow ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
                )}
              >
                {data.openNow ? T.open[lang] : T.closed[lang]}
              </span>
            )}
            {data.hours.length > 0 && (
              <button
                type="button"
                onClick={() => setHoursOpen((v) => !v)}
                className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-gold-deep"
                aria-expanded={hoursOpen}
              >
                <Clock className="size-3.5" /> {T.hours[lang]}
                <ChevronDown className={cn("size-3.5 transition-transform", hoursOpen && "rotate-180")} />
              </button>
            )}
          </div>
          {hoursOpen && (
            <ul className="mt-3 space-y-1 rounded-xl bg-[#faf6ee] p-3 text-[12.5px] text-ink/75">
              {data.hours.map((h) => (
                <li key={h} className="capitalize">
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
