"use client";

import { ArrowDownRight, ArrowUpRight, BedDouble, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { dayActivity, laneAt, monthStats, monthWeeks, type CalendarData, type CalendarStay } from "@/lib/finances/calendar";
import { channelColor } from "@/lib/finances/charts";
import { eur, pct } from "@/lib/finances/filters";
import { channelLabel } from "@/lib/finances/report";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const LEGEND = [
  { channel: "airbnbOfficial", label: "Airbnb" },
  { channel: "bookingcom", label: "Booking" },
  { channel: "direct", label: "Direct" },
];

const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const monthTitle = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const dayTitle = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const nightsBetween = (a: string, b: string) => Math.round((utc(b).getTime() - utc(a).getTime()) / 86_400_000);

/** Appareil avec souris : détail au survol ; sinon (tactile) au toucher, en panneau du bas. */
function useCanHover() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(hover: hover) and (pointer: fine)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(hover: hover) and (pointer: fine)").matches,
    () => true,
  );
}

type Props = {
  data: CalendarData;
  today: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  /** Lien « voir ce bien seul » pour chaque bien (absent quand un seul bien est affiché). */
  unitHrefs?: Record<string, string>;
};

export function FinanceCalendar({ data, today, prevHref, nextHref, todayHref, unitHrefs }: Props) {
  const canHover = useCanHover();
  const [active, setActive] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [focusUnit, setFocusUnit] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const weeks = useMemo(() => monthWeeks(data.month), [data.month]);
  const stats = useMemo(() => monthStats(data), [data]);
  const single = data.units.length === 1;
  // Une ligne par bien ayant au moins un séjour dans le mois, dans l'ordre des biens.
  const lanes = useMemo(() => {
    const byUnit = new Map<string, CalendarStay[]>();
    for (const s of data.stays) byUnit.set(s.unit, [...(byUnit.get(s.unit) ?? []), s]);
    return data.units.filter((u) => byUnit.has(u.key)).map((u) => ({ ...u, stays: byUnit.get(u.key)! }));
  }, [data]);
  const laneHeight = single ? 22 : lanes.length <= 3 ? 12 : lanes.length <= 6 ? 7 : 5;
  const laneGap = lanes.length > 6 ? 2 : 3;
  const lanesBlock = lanes.length * laneHeight + Math.max(0, lanes.length - 1) * laneGap;

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const hoverOpen = (day: string) => {
    if (!canHover || pinned) return;
    clear();
    timer.current = setTimeout(() => setActive(day), active ? 60 : 160);
  };
  const hoverClose = () => {
    if (!canHover || pinned) return;
    clear();
    timer.current = setTimeout(() => setActive(null), 180);
  };
  const close = () => {
    clear();
    setActive(null);
    setPinned(false);
  };
  const click = (day: string) => {
    clear();
    if (active === day && pinned) return close();
    setActive(day);
    setPinned(true);
  };

  const activity = active ? dayActivity(data.stays, active) : null;
  const detail = active && activity && (
    <DayDetail day={active} activity={activity} units={data.units.length} single={single} today={today} />
  );

  return (
    <section className="rounded-3xl border border-border/80 bg-card shadow-[0_1px_0_rgba(18,22,42,.04),0_20px_40px_-28px_rgba(18,22,42,.35)]">
      {/* En-tête : mois, navigation, chiffres du mois, légende */}
      <div className="flex flex-col gap-4 border-b border-border/70 px-4 pt-5 pb-4 sm:px-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.25em] text-gold-deep uppercase">Calendrier des séjours</p>
            <h2 className="mt-1 font-serif text-3xl leading-none text-ink capitalize sm:text-4xl">{monthTitle.format(utc(`${data.month}-01`))}</h2>
          </div>
          <nav className="flex items-center gap-1" aria-label="Changer de mois">
            <NavLink href={prevHref} label="Mois précédent">
              <ChevronLeft className="size-4" />
            </NavLink>
            {!today.startsWith(data.month) && (
              <Link
                href={todayHref}
                scroll={false}
                className="h-8 rounded-lg border border-input px-3 text-sm leading-8 font-medium text-ink transition hover:bg-accent"
              >
                Aujourd&apos;hui
              </Link>
            )}
            <NavLink href={nextHref} label="Mois suivant">
              <ChevronRight className="size-4" />
            </NavLink>
          </nav>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Stat label="Occupation" value={pct(stats.occupancy)} />
            <Stat label="Nuits occupées" value={`${stats.nights} / ${stats.available}`} />
            <Stat label="Arrivées" value={String(stats.arrivals)} />
          </dl>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Couleurs des plateformes">
            {LEGEND.map((l) => (
              <li key={l.channel} className="flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-full" style={{ background: channelColor(l.channel) }} /> {l.label}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full" style={{ background: channelColor("autre") }} /> Autre
            </li>
          </ul>
        </div>
      </div>

      {/* Grille */}
      <div className="px-1.5 pb-2 sm:px-3">
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className={cn("py-2.5 text-center text-[11px] font-semibold tracking-[0.15em]", i >= 5 ? "text-muted-foreground" : "text-ink/70")}>
              {d}
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/70">
          {weeks.map((week, w) => (
            <div key={w} className={cn("grid grid-cols-7", w > 0 && "border-t border-border/70")}>
              {week.map((day, i) => {
                const a = day.inMonth ? dayActivity(data.stays, day.date) : null;
                const isToday = day.date === today;
                const open = active === day.date;
                const cell = (
                  <button
                    type="button"
                    disabled={!day.inMonth}
                    onMouseEnter={() => day.inMonth && hoverOpen(day.date)}
                    onMouseLeave={hoverClose}
                    onClick={() => click(day.date)}
                    aria-label={
                      a
                        ? `${dayTitle.format(utc(day.date))} : ${a.occupied} logement${a.occupied > 1 ? "s" : ""} occupé${a.occupied > 1 ? "s" : ""}, ${a.arrivals.length} arrivée${a.arrivals.length > 1 ? "s" : ""}, ${a.departures.length} départ${a.departures.length > 1 ? "s" : ""}`
                        : undefined
                    }
                    aria-expanded={day.inMonth ? open : undefined}
                    className={cn(
                      "group/day relative flex w-full flex-col text-left outline-none",
                      i > 0 && "border-l border-border/70",
                      day.inMonth ? "cursor-pointer" : "cursor-default bg-muted/30",
                      day.inMonth && day.weekend && "bg-sand/35",
                      day.inMonth && "transition-colors hover:bg-accent/45 focus-visible:bg-accent/45",
                      open && "bg-accent/60 hover:bg-accent/60",
                    )}
                    style={{ minHeight: Math.max(single ? 76 : 70, 40 + lanesBlock) }}
                  >
                    <span className="flex items-start justify-between gap-1 px-1.5 pt-1.5 sm:px-2 sm:pt-2">
                      <span
                        className={cn(
                          "grid size-7 place-items-center rounded-full font-serif text-[15px] leading-none tabular-nums sm:size-8 sm:text-lg",
                          !day.inMonth && "text-muted-foreground/50",
                          day.inMonth && !isToday && (day.weekend ? "text-ink/60" : "text-ink"),
                          isToday && "bg-night text-ivory shadow-[0_0_0_2px_var(--color-gold)]",
                        )}
                      >
                        {Number(day.date.slice(8))}
                      </span>
                      {a && a.occupied > 0 && !single && (
                        <span className="mt-1 hidden text-[10px] text-muted-foreground tabular-nums sm:block">
                          {a.occupied}/{data.units.length}
                        </span>
                      )}
                    </span>
                    {day.inMonth && (
                      <span className="mt-auto mb-2 flex flex-col" style={{ gap: laneGap }} aria-hidden>
                        {lanes.map((lane) => (
                          <Lane
                            key={lane.key}
                            stays={lane.stays}
                            day={day.date}
                            weekday={i}
                            height={laneHeight}
                            label={single}
                            dimmed={focusUnit !== null && focusUnit !== lane.key}
                          />
                        ))}
                      </span>
                    )}
                    {a && a.arrivals.length > 0 && (
                      <span className="absolute top-2 right-1.5 size-1.5 rounded-full bg-gold sm:hidden" aria-hidden />
                    )}
                  </button>
                );
                if (!day.inMonth || !canHover) return <div key={day.date} className="contents">{cell}</div>;
                return (
                  <Popover key={day.date} open={open} onOpenChange={(o) => !o && close()}>
                    <PopoverAnchor asChild>{cell}</PopoverAnchor>
                    <PopoverContent
                      side="right"
                      align="start"
                      sideOffset={6}
                      collisionPadding={16}
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      onCloseAutoFocus={(e) => e.preventDefault()}
                      onMouseEnter={clear}
                      onMouseLeave={hoverClose}
                      className="w-[23rem] max-w-[calc(100vw-2rem)] gap-0 rounded-2xl p-0 shadow-[0_24px_60px_-24px_rgba(18,22,42,.45)]"
                    >
                      {detail}
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Biens : une ligne chacun, dans cet ordre */}
      {!single && (
        <div className="border-t border-border/70 px-4 py-4 sm:px-6">
          <p className="text-xs text-muted-foreground">
            Dans chaque jour, une ligne par bien, dans cet ordre (survolez un bien pour le repérer, cliquez pour le voir seul) :
          </p>
          <ol className="mt-2.5 flex flex-wrap gap-1.5" onMouseLeave={() => setFocusUnit(null)}>
            {data.units.map((u) => {
              const lane = lanes.findIndex((l) => l.key === u.key);
              const chip = (
                <>
                  <span className={cn("grid size-4 place-items-center rounded-full text-[9px] font-semibold tabular-nums", lane >= 0 ? "bg-night text-ivory" : "bg-muted text-muted-foreground")}>
                    {lane >= 0 ? lane + 1 : "–"}
                  </span>
                  {u.name}
                </>
              );
              const cls = cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                lane >= 0 ? "border-border text-ink hover:border-gold hover:bg-accent/50" : "border-dashed border-border text-muted-foreground",
                focusUnit === u.key && "border-gold bg-accent/60",
              );
              return (
                <li key={u.key} onMouseEnter={() => lane >= 0 && setFocusUnit(u.key)}>
                  {unitHrefs?.[u.key] ? (
                    <Link href={unitHrefs[u.key]} scroll={false} className={cls} title={lane >= 0 ? "Voir ce bien seul" : "Aucun séjour ce mois-ci"}>
                      {chip}
                    </Link>
                  ) : (
                    <span className={cls}>{chip}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Tactile : détail du jour dans un panneau du bas */}
      {!canHover && (
        <Sheet open={active !== null} onOpenChange={(o) => !o && close()}>
          <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-3xl p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{active ? capitalize(dayTitle.format(utc(active))) : "Détail du jour"}</SheetTitle>
              <SheetDescription>Réservations du jour</SheetDescription>
            </SheetHeader>
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-muted" aria-hidden />
            {detail}
          </SheetContent>
        </Sheet>
      )}
    </section>
  );
}

function NavLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      className="grid size-8 place-items-center rounded-lg border border-input text-ink transition hover:bg-accent"
    >
      {children}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 font-serif text-xl text-ink tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Ligne d'un bien dans un jour : moitié gauche = nuit précédente, moitié droite = nuit du jour.
 * Un séjour forme ainsi une barre continue d'un jour à l'autre, qui commence au milieu du jour
 * d'arrivée et s'arrête au milieu du jour de départ (comme un planning de location).
 */
function Lane({ stays, day, weekday, height, label, dimmed }: { stays: CalendarStay[]; day: string; weekday: number; height: number; label: boolean; dimmed: boolean }) {
  const { previous, current } = laneAt(stays, day);
  const round = Math.min(height / 2, 6);
  const piece = (s: CalendarStay, style: React.CSSProperties) => (
    <span className="absolute inset-y-0" style={{ background: channelColor(s.channel), ...style }} />
  );
  // Nom du voyageur : au jour d'arrivée, ou en début de semaine pour un séjour commencé avant.
  const showLabel = label && current && (current.arrival === day || weekday === 0);
  const span = showLabel ? Math.min(nightsBetween(day, current.departure), 7 - weekday) : 0;
  return (
    // Fond léger de la ligne : une nuit libre reste visible comme un creux.
    <span className={cn("relative block bg-ink/[0.045] transition-opacity", dimmed && "opacity-20")} style={{ height }}>
      {previous && current && previous.id === current.id ? (
        piece(current, { left: 0, right: -1 })
      ) : (
        <>
          {previous && piece(previous, { left: 0, width: "calc(50% - 3px)", borderTopRightRadius: round, borderBottomRightRadius: round })}
          {current && piece(current, { left: "calc(50% + 3px)", right: -1, borderTopLeftRadius: round, borderBottomLeftRadius: round })}
        </>
      )}
      {showLabel && (
        <span
          className="pointer-events-none absolute inset-y-0 z-10 truncate text-[11px] leading-[22px] font-medium text-white"
          style={{
            left: current.arrival === day ? "calc(50% + 9px)" : 6,
            width: current.arrival === day ? `calc(${span * 100}% - 50% - 14px)` : `calc(${span * 100}% - 12px)`,
          }}
        >
          {current.guestName ?? channelLabel(current.channel)}
        </span>
      )}
    </span>
  );
}

type Activity = ReturnType<typeof dayActivity>;

/** Détail d'un jour : arrivées, séjours en cours et départs, avec les montants du séjour entier. */
function DayDetail({ day, activity, units, single, today }: { day: string; activity: Activity; units: number; single: boolean; today: string }) {
  const { arrivals, staying, departures, occupied } = activity;
  const empty = !arrivals.length && !staying.length && !departures.length;
  return (
    <div className="flex flex-col">
      <div className="border-b border-border/70 px-4 pt-4 pb-3.5">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-gold-deep uppercase">{day === today ? "Aujourd'hui" : day < today ? "Passé" : "À venir"}</p>
        <p className="mt-1 font-serif text-2xl leading-tight text-ink">{capitalize(dayTitle.format(utc(day)))}</p>
        {!single && (
          <div className="mt-2.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-ink tabular-nums">{occupied}</span> logement{occupied > 1 ? "s" : ""} occupé{occupied > 1 ? "s" : ""} sur {units} ce soir
              </span>
              <span className="tabular-nums">{pct(units ? occupied / units : null)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gold" style={{ width: `${units ? (occupied / units) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </div>
      <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
        {empty && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Aucun séjour ce jour-là.</p>}
        <Group title="Arrivées" icon={<ArrowDownRight className="size-3.5" />} stays={arrivals} day={day} />
        <Group title="En séjour" icon={<BedDouble className="size-3.5" />} stays={staying} day={day} />
        <Group title="Départs" icon={<ArrowUpRight className="size-3.5" />} stays={departures} day={day} />
      </div>
      {!empty && (
        <p className="border-t border-border/70 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          Montants du séjour entier · net = après plateformes et taxes, avant vos charges.
        </p>
      )}
    </div>
  );
}

function Group({ title, icon, stays, day }: { title: string; icon: React.ReactNode; stays: CalendarStay[]; day: string }) {
  if (!stays.length) return null;
  return (
    <div className="py-1.5">
      <p className="flex items-center gap-1.5 px-2 pb-1 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        {icon} {title} <span className="tabular-nums">· {stays.length}</span>
      </p>
      <ul>
        {stays.map((s) => {
          const night = nightsBetween(s.arrival, day) + 1;
          return (
            <li key={s.id} className="flex gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-accent/40">
              <span className="w-1 shrink-0 self-stretch rounded-full" style={{ background: channelColor(s.channel) }} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-medium text-ink">{s.unitName}</p>
                  <p className="shrink-0 font-medium text-ink tabular-nums">{eur(s.gross)}</p>
                </div>
                <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                  <p className="truncate">
                    {s.guestName ?? <span className="italic">Nom effacé par la plateforme</span>} · {channelLabel(s.channel)}
                  </p>
                  <p className="shrink-0 tabular-nums">net {eur(s.payout)}</p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {shortDay.format(utc(s.arrival))} → {shortDay.format(utc(s.departure))} · {s.nights} nuit{s.nights > 1 ? "s" : ""}
                  {s.arrival < day && day < s.departure && ` · nuit ${night}/${s.nights}`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
