"use client";

import { ArrowRight, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { imageUrl } from "@/lib/image-url";

/** Page « Emplacement » : le titre du logement et les photos de son emplacement, rien d'autre. */
export function LocationPage({
  title,
  photoIds,
  livretHref,
}: {
  title: string;
  photoIds: string[];
  livretHref: string;
}) {
  const [zoom, setZoom] = useState<string | null>(null);

  return (
    <div className="min-h-dvh bg-night text-ivory">
      <div className="relative mx-auto max-w-[520px] px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="grain pointer-events-none fixed inset-0" />

        <header className="relative flex flex-col items-center pb-8 text-center">
          <Image src="/brand/monogram.png" alt="Elypse Home" width={513} height={638} priority className="h-auto w-10" />
          <h1 className="animate-rise mt-6 font-serif text-[2.3rem] leading-[1.08] font-medium">{title}</h1>
          <span className="gold-hairline mt-6 h-px w-20" />
        </header>

        <main className="relative space-y-3">
          {photoIds.map((id, i) => (
            <button
              key={id}
              type="button"
              onClick={() => setZoom(imageUrl(id))}
              className="animate-rise block w-full overflow-hidden rounded-[1.6rem] bg-night-2"
              style={{ animationDelay: `${120 + i * 80}ms` }}
              aria-label={`Photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl(id)!} alt="" loading={i === 0 ? "eager" : "lazy"} className="w-full object-cover" />
            </button>
          ))}
        </main>

        <footer className="relative mt-10 flex justify-center">
          <Link
            href={livretHref}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-gold/40 px-5 text-[12px] font-semibold tracking-[0.14em] text-gold-light uppercase transition hover:bg-white/5"
          >
            Livret d&apos;accueil · Welcome guide <ArrowRight className="size-3.5" />
          </Link>
        </footer>
      </div>

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
  );
}
