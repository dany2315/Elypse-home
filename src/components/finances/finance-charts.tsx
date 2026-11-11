"use client";

/**
 * Graphiques du tableau de bord Finances (HTML + CSS, sans bibliothèque).
 * Palette validée (scripts/validate_palette.js du skill dataviz, fond #ffffff, paires adjacentes) :
 * bleu #3a5bc7 · or #c9a45c · violet #7a6fd6. L'or est sous 3:1 de contraste : les valeurs
 * restent lisibles par les étiquettes, les infobulles et les tableaux de la page.
 * L'app n'a pas de thème sombre : seul le mode clair est défini.
 */
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type TrendPoint = {
  key: string;
  label: string;
  shortLabel: string;
  payout: number;
  fees: number;
  cityTax: number;
  stays: number;
  highlight?: boolean;
};
export type BarItem = { key: string; label: string; value: number; detail?: string };
export type ShareItem = { key: string; label: string; value: number };

const SERIES = [
  { key: "payout", label: "Versement total", color: "#3a5bc7", ink: "#ffffff" },
  { key: "fees", label: "Commissions et frais", color: "#c9a45c", ink: "#12162a" },
  { key: "cityTax", label: "Taxe de séjour", color: "#7a6fd6", ink: "#ffffff" },
] as const;

const eurFmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const compactFmt = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const pctFmt = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
const nb = (s: string) => s.replace(/ /g, " ");
const eur = (cents: number) => nb(eurFmt.format(cents / 100));
const eurCompact = (cents: number) => `${nb(compactFmt.format(cents / 100))} €`;

/** Graduations « propres » (1, 2, 2,5, 5 × 10ⁿ) couvrant `max`. */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

function Card({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-3xl border border-border/80 bg-card p-4 shadow-[0_1px_0_rgba(18,22,42,.04),0_20px_40px_-28px_rgba(18,22,42,.35)] sm:p-6",
        className,
      )}
    >
      <h2 className="font-serif text-2xl leading-tight text-ink">{title}</h2>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-4 sm:mt-5">{children}</div>
    </section>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink/80">
      {SERIES.map((s) => (
        <li key={s.key} className="flex items-center gap-2">
          <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

type Tip = { x: number; width: number; point: TrendPoint } | null;

/* --------------------------- Évolution (colonnes) -------------------------- */

export function TrendChart({ points, title, subtitle, className }: { points: TrendPoint[]; title: string; subtitle?: string; className?: string }) {
  const [tip, setTip] = useState<Tip>(null);
  const frame = useRef<HTMLDivElement>(null);
  const id = useId();
  const totals = points.map((p) => p.payout + p.fees + p.cityTax);
  const ticks = niceTicks(Math.max(0, ...totals));
  const top = ticks[ticks.length - 1] || 1;
  const maxIndex = totals.indexOf(Math.max(...totals));
  const H = 220;

  function show(e: React.PointerEvent | React.FocusEvent, point: TrendPoint) {
    const box = frame.current?.getBoundingClientRect();
    const el = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (!box) return;
    setTip({ x: el.left - box.left + el.width / 2, width: box.width, point });
  }

  return (
    <Card title={title} subtitle={subtitle} className={className}>
      <Legend />
      <MobileTrend points={points} totals={totals} />
      <div ref={frame} className="relative mt-7 hidden sm:block" onPointerLeave={() => setTip(null)}>
        <div className="flex">
          {/* Axe des valeurs */}
          <div className="relative mr-2 w-14 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums" style={{ height: H }}>
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
                {eurCompact(t)}
              </span>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            {/* Grille (hairlines) */}
            <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: H }} aria-hidden>
              {ticks.map((t) => (
                <div
                  key={t}
                  className={cn("absolute inset-x-0 h-px", t === 0 ? "bg-ink/25" : "bg-border/70")}
                  style={{ bottom: `${(t / top) * 100}%` }}
                />
              ))}
            </div>
            <div className="relative flex items-end" style={{ height: H }} role="list" aria-label={title}>
              {points.map((p, i) => {
                const total = totals[i];
                const segments = SERIES.map((s) => ({ ...s, value: p[s.key] })).filter((s) => s.value > 0);
                return (
                  <div
                    key={p.key}
                    role="listitem"
                    tabIndex={0}
                    aria-describedby={tip?.point.key === p.key ? `${id}-tip` : undefined}
                    aria-label={`${p.label} : versement ${eur(p.payout)}, commissions et frais ${eur(p.fees)}, taxe de séjour ${eur(p.cityTax)}`}
                    onPointerEnter={(e) => show(e, p)}
                    onFocus={(e) => show(e, p)}
                    onBlur={() => setTip(null)}
                    className="group relative flex h-full flex-1 cursor-default flex-col items-center justify-end outline-none"
                  >
                    {/* Valeur au sommet : seulement pour la colonne la plus haute et le mois sélectionné */}
                    {total > 0 && (i === maxIndex || p.highlight) && (
                      <span className="mb-1 text-[11px] font-semibold whitespace-nowrap text-ink tabular-nums">{eurCompact(total)}</span>
                    )}
                    <div
                      className="flex w-full max-w-6 flex-col-reverse gap-[2px] transition group-hover:brightness-110 group-focus-visible:ring-2 group-focus-visible:ring-gold/60"
                      style={{ height: `${(total / top) * 100}%` }}
                    >
                      {segments.map((s, j) => (
                        <div
                          key={s.key}
                          className={cn(j === segments.length - 1 && "rounded-t-[4px]")}
                          style={{ background: s.color, flexGrow: s.value, flexBasis: 0, minHeight: 1 }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Axe des mois */}
            <div className="mt-2 flex">
              {points.map((p) => (
                <span
                  key={p.key}
                  className={cn(
                    "flex-1 truncate px-0.5 text-center text-[11px] capitalize",
                    p.highlight ? "font-semibold text-ink" : "text-muted-foreground",
                  )}
                >
                  {p.shortLabel}
                </span>
              ))}
            </div>
          </div>
        </div>

        {tip && (
          <div
            id={`${id}-tip`}
            role="tooltip"
            className="pointer-events-none absolute top-2 z-10 w-56 rounded-xl border border-border bg-card px-3.5 py-3 text-xs shadow-xl"
            // À droite de la colonne, ou à gauche s'il n'y a pas la place (largeur de l'infobulle : 224 px).
            style={{ left: tip.x + 20 + 224 <= tip.width ? tip.x + 20 : Math.max(0, tip.x - 20 - 224) }}
          >
            <p className="font-medium text-ink first-letter:uppercase">{tip.point.label}</p>
            <p className="mt-0.5 text-muted-foreground">
              {tip.point.stays} séjour{tip.point.stays > 1 ? "s" : ""} · payé par les voyageurs{" "}
              <span className="font-semibold text-ink tabular-nums">{eur(tip.point.payout + tip.point.fees + tip.point.cityTax)}</span>
            </p>
            <ul className="mt-2 space-y-1">
              {[...SERIES].reverse().map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden />
                  <span className="font-semibold text-ink tabular-nums">{eur(tip.point[s.key])}</span>
                  <span className="truncate text-muted-foreground">{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Mobile : un mois par ligne, barre empilée horizontale ; toucher une ligne affiche le détail. */
function MobileTrend({ points, totals }: { points: TrendPoint[]; totals: number[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const max = Math.max(1, ...totals);
  return (
    <ul className="mt-4 space-y-1.5 sm:hidden">
      {points.map((p, i) => {
        const segments = SERIES.map((s) => ({ ...s, value: p[s.key] })).filter((s) => s.value > 0);
        const expanded = open === p.key;
        return (
          <li key={p.key}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : p.key)}
              className="grid w-full grid-cols-[3.25rem_minmax(0,1fr)_4.25rem] items-center gap-2 rounded-lg py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <span className={cn("truncate text-xs capitalize", p.highlight ? "font-semibold text-ink" : "text-muted-foreground")}>
                {p.shortLabel}
              </span>
              <span className="flex h-3.5 min-w-0 gap-[2px]" style={{ width: `${(totals[i] / max) * 100}%` }} aria-hidden>
                {segments.map((s, j) => (
                  <span
                    key={s.key}
                    className={cn("h-full", j === segments.length - 1 && "rounded-r-[4px]")}
                    style={{ background: s.color, flexGrow: s.value, flexBasis: 0, minWidth: 1 }}
                  />
                ))}
              </span>
              <span className={cn("text-right text-xs tabular-nums", p.highlight ? "font-semibold text-ink" : "text-ink/80")}>
                {totals[i] > 0 ? eurCompact(totals[i]) : "—"}
              </span>
            </button>
            {expanded && (
              <div className="mt-1 mb-2 ml-[3.75rem] rounded-xl border border-border bg-card px-3 py-2.5 text-xs">
                <p className="font-medium text-ink first-letter:uppercase">{p.label}</p>
                <p className="mt-0.5 text-muted-foreground">
                  {p.stays} séjour{p.stays > 1 ? "s" : ""} · payé par les voyageurs{" "}
                  <span className="font-semibold text-ink tabular-nums">{eur(totals[i])}</span>
                </p>
                <ul className="mt-1.5 space-y-1">
                  {SERIES.map((s) => (
                    <li key={s.key} className="flex items-center gap-2">
                      <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                      <span className="font-semibold text-ink tabular-nums">{eur(p[s.key])}</span>
                      <span className="truncate text-muted-foreground">{s.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ----------------------- Barres horizontales classées ---------------------- */

export function RankedBars({ items, title, subtitle, className }: { items: BarItem[]; title: string; subtitle?: string; className?: string }) {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...sorted.map((i) => i.value));
  const [hover, setHover] = useState<string | null>(null);
  return (
    <Card title={title} subtitle={subtitle} className={className}>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun versement sur la période.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((i) => (
            <li
              key={i.key}
              tabIndex={0}
              aria-label={`${i.label} : ${eur(i.value)}${i.detail ? `, ${i.detail}` : ""}`}
              onPointerEnter={() => setHover(i.key)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i.key)}
              onBlur={() => setHover(null)}
              className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-gold/60 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
            >
              <span className="truncate text-sm text-ink/85">{i.label}</span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span
                    className="block h-3.5 rounded-r-[4px] transition-[filter]"
                    style={{ width: `${(i.value / max) * 100}%`, background: SERIES[0].color, filter: hover === i.key ? "brightness(1.12)" : undefined }}
                  />
                </span>
                <span className="text-xs font-semibold whitespace-nowrap text-ink tabular-nums">{eurCompact(i.value)}</span>
                {hover === i.key && i.detail && (
                  <span className="hidden text-xs whitespace-nowrap text-muted-foreground lg:inline">· {i.detail}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* --------------------------- Barre segmentée haute -------------------------- */

const SHARE_COLORS = [SERIES[0], SERIES[1], SERIES[2]];

export function ShareBar({ items, title, subtitle, className }: { items: ShareItem[]; title: string; subtitle?: string; className?: string }) {
  const parts = items.filter((i) => i.value > 0).slice(0, 3);
  const total = parts.reduce((a, b) => a + b.value, 0);
  const [hover, setHover] = useState<string | null>(null);
  const active = parts.find((p) => p.key === hover);
  return (
    <Card title={title} subtitle={subtitle} className={className}>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun revenu sur la période.</p>
      ) : (
        <>
          <div className="flex h-7 gap-[2px]" role="img" aria-label={parts.map((p) => `${p.label} ${pctFmt.format(p.value / total)}`).join(", ")}>
            {parts.map((p, i) => {
              const share = p.value / total;
              const c = SHARE_COLORS[i];
              return (
                <div
                  key={p.key}
                  tabIndex={0}
                  onPointerEnter={() => setHover(p.key)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(p.key)}
                  onBlur={() => setHover(null)}
                  aria-label={`${p.label} : ${eur(p.value)} (${pctFmt.format(share)})`}
                  className="flex items-center overflow-visible rounded-[4px] px-2 text-xs font-semibold outline-none transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-gold/60"
                  style={{ flexGrow: p.value, flexBasis: 0, background: c.color, color: c.ink }}
                >
                  {/* Part imprimée seulement si le bloc est assez large */}
                  {share >= 0.12 && nb(pctFmt.format(share))}
                </div>
              );
            })}
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {parts.map((p, i) => (
              <li key={p.key} className={cn("flex items-center gap-2 rounded-md px-1 transition", active?.key === p.key && "bg-accent/60")}>
                <span className="size-2.5 rounded-[3px]" style={{ background: SHARE_COLORS[i].color }} aria-hidden />
                <span className="text-ink/85">{p.label}</span>
                <span className="ml-auto font-semibold text-ink tabular-nums">{eur(p.value)}</span>
                <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{nb(pctFmt.format(p.value / total))}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
