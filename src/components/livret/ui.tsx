"use client";

import { Check, Copy, Navigation } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const mapsUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
export const wazeUrl = (q: string) => `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`;
export const telUrl = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[10.5px] font-semibold tracking-[0.28em] text-gold-deep uppercase", className)}>
      {children}
    </p>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[1.6rem] border border-[#ebe3d3] bg-white p-5 shadow-[0_1px_0_rgba(18,22,42,.03),0_18px_40px_-30px_rgba(18,22,42,.35)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CopyButton({
  value,
  label,
  copiedLabel,
  className,
  variant = "light",
}: {
  value: string;
  label: string;
  copiedLabel: string;
  className?: string;
  variant?: "light" | "dark" | "gold";
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    navigator.vibrate?.(10);
    setTimeout(() => setCopied(false), 1600);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[13px] font-semibold tracking-wide transition active:scale-[0.97]",
        variant === "light" && "border border-[#e3d9c6] bg-[#faf6ee] text-ink hover:border-gold",
        variant === "dark" && "bg-night text-ivory hover:bg-night-2",
        variant === "gold" && "bg-gold-foil text-night shadow-[0_10px_24px_-12px_rgba(201,164,92,.9)]",
        className,
      )}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? copiedLabel : label}
    </button>
  );
}

/** Code mis en valeur (code d'entrée, boîte à clés, mot de passe wifi). */
export function CodeDisplay({ value, className }: { value: string; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gold/30 bg-[linear-gradient(180deg,#fffdf8,#f7f0e1)] px-5 py-4 text-center font-mono text-[1.65rem] font-semibold tracking-[0.18em] break-all text-ink",
        className,
      )}
    >
      {value}
    </div>
  );
}

export function NavButtons({ query, className }: { query: string; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <a
        href={mapsUrl(query)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-night text-[13px] font-semibold text-ivory transition active:scale-[0.97]"
      >
        <Navigation className="size-4 text-gold-light" /> Google Maps
      </a>
      <a
        href={wazeUrl(query)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#e3d9c6] bg-white text-[13px] font-semibold text-ink transition active:scale-[0.97]"
      >
        <WazeIcon className="size-4 text-[#33ccff]" /> Waze
      </a>
    </div>
  );
}

export function WazeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M4.5 15.5c-1.4-.3-2-1.3-2-2.3 1 .3 1.6-.2 1.7-1.5C4.6 7.2 8 4 12.2 4c4.6 0 8.3 3.5 8.3 7.9 0 3.9-3 6.8-6.6 7.4" strokeLinecap="round" />
      <circle cx="8" cy="19" r="1.6" />
      <circle cx="15.5" cy="19.3" r="1.6" />
      <circle cx="10" cy="10.5" r=".6" fill="currentColor" />
      <circle cx="15" cy="10.5" r=".6" fill="currentColor" />
      <path d="M10 13.5c1.2 1.1 3.3 1.1 4.6-.2" strokeLinecap="round" />
    </svg>
  );
}

/** Texte multiligne qui respecte les retours à la ligne saisis dans le dashboard. */
export function Prose({ text, className }: { text: string; className?: string }) {
  if (!text.trim()) return null;
  return <p className={cn("text-[15px] leading-relaxed whitespace-pre-line text-ink/80", className)}>{text.trim()}</p>;
}
