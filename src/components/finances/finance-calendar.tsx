"use client";

import { ArrowDownRight, ArrowUpRight, BedDouble, ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

type Props = {
  data: CalendarData;
  today: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  /** Lien « voir ce bien seul » pour chaque bien de la légende. */
  unitHrefs: Record<string, string>;
  /** Lien vers tous les biens (pour désélectionner le bien affiché seul). */
  allHref: string;
  /** Bien affiché seul, ou null pour tous les biens. */
  selected: string | null;
};

export function FinanceCalendar({ data, today, prevHref, nextHref, todayHref, unitHrefs, allHref, selected }: Props) {
  // Détail du jour : petite carte au survol / clic à la souris, panneau du bas au toucher.
  // Le mode suit l'appareil qui a réellement servi (souris ou doigt), pas le type d'écran annoncé.
  const [mode, setMode] = useState<"popover" | "sheet">("popover");
  const [active, setActive] = useState<string | null>(null);
  // Jour affiché dans le détail : gardé pendant l'animation de fermeture.
  const [shown, setShown] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const pointer = useRef("mouse");
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
  const open = (day: string, m: "popover" | "sheet") => {
    setMode(m);
    setShown(day);
    setActive(day);
  };
  const hoverOpen = (day: string) => {
    if (pinned) return;
    clear();
    timer.current = setTimeout(() => open(day, "popover"), active ? 60 : 160);
  };
  const hoverClose = () => {
    if (pinned || mode === "sheet") return;
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
    const m = pointer.current === "mouse" ? "popover" : "sheet";
    if (active === day && pinned && mode === m) return close();
    open(day, m);
    setPinned(true);
  };

  const activity = shown ? dayActivity(data.stays, shown) : null;
  const detail = (sheet: boolean) =>
    shown && activity && <DayDetail day={shown} activity={activity} units={data.units.length} single={single} today={today} sheet={sheet} />;

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
                const isOpen = active === day.date;
                const cell = (
                  <button
                    type="button"
                    disabled={!day.inMonth}
                    onPointerDown={(e) => (pointer.current = e.pointerType)}
                    onPointerEnter={(e) => e.pointerType === "mouse" && day.inMonth && hoverOpen(day.date)}
                    onPointerLeave={(e) => e.pointerType === "mouse" && hoverClose()}
                    onClick={() => click(day.date)}
                    aria-label={
                      a
                        ? `${dayTitle.format(utc(day.date))} : ${a.occupied} logement${a.occupied > 1 ? "s" : ""} occupé${a.occupied > 1 ? "s" : ""}, ${a.arrivals.length} arrivée${a.arrivals.length > 1 ? "s" : ""}, ${a.departures.length} départ${a.departures.length > 1 ? "s" : ""}`
                        : undefined
                    }
                    aria-expanded={day.inMonth ? isOpen : undefined}
                    className={cn(
                      "group/day relative flex w-full flex-col text-left outline-none",
                      i > 0 && "border-l border-border/70",
                      day.inMonth ? "cursor-pointer" : "cursor-default bg-muted/30",
                      day.inMonth && day.weekend && "bg-sand/35",
                      day.inMonth && "transition-colors hover:bg-accent/45 focus-visible:bg-accent/45",
                      isOpen && "bg-accent/60 hover:bg-accent/60",
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
                if (!day.inMonth) return <div key={day.date} className="contents">{cell}</div>;
                return (
                  <Popover key={day.date} open={isOpen && mode === "popover"} onOpenChange={(o) => !o && close()}>
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
                      {detail(false)}
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Biens : toujours visibles. Tous les biens : une ligne chacun, dans cet ordre (numéros).
          Un bien seul : son badge ressort, le toucher à nouveau revient à tous les biens. */}
      {data.legend.length > 1 && (
        <div className="border-t border-border/70 px-4 py-4 sm:px-6">
          <p className="text-xs text-muted-foreground">
            {selected
              ? "Un seul bien affiché. Touchez-le à nouveau pour revoir tous les biens, ou choisissez-en un autre."
              : "Dans chaque jour, une ligne par bien, dans cet ordre. Choisissez un bien pour le voir seul."}
          </p>
          <ol className="mt-2.5 flex flex-wrap gap-1.5" onMouseLeave={() => setFocusUnit(null)}>
            {data.legend.map((u) => {
              const isSelected = selected === u.key;
              const lane = selected ? -1 : lanes.findIndex((l) => l.key === u.key);
              const empty = !selected && lane < 0;
              return (
                <li key={u.key} onMouseEnter={() => lane >= 0 && setFocusUnit(u.key)}>
                  <Link
                    href={isSelected ? allHref : unitHrefs[u.key]}
                    scroll={false}
                    aria-current={isSelected ? "true" : undefined}
                    title={isSelected ? "Revoir tous les biens" : empty ? "Aucun séjour ce mois-ci" : "Voir ce bien seul"}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                      isSelected
                        ? "border-night bg-night text-ivory hover:bg-night-3"
                        : empty
                          ? "border-dashed border-border text-muted-foreground hover:border-gold"
                          : "border-border text-ink hover:border-gold hover:bg-accent/50",
                      focusUnit === u.key && "border-gold bg-accent/60",
                    )}
                  >
                    {!selected && (
                      <span
                        className={cn(
                          "grid size-4 place-items-center rounded-full text-[9px] font-semibold tabular-nums",
                          lane >= 0 ? "bg-night text-ivory" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {lane >= 0 ? lane + 1 : "–"}
                      </span>
                    )}
                    {u.name}
                    {isSelected && <X className="size-3.5 text-gold-light" aria-label="désélectionner" />}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Tactile : détail du jour dans un panneau du bas. En-tête et bouton « Fermer » fixes,
          seule la liste défile : la fermeture reste toujours à portée de doigt. */}
      <Sheet open={active !== null && mode === "sheet"} onOpenChange={(o) => !o && close()}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[88dvh] gap-0 overflow-hidden rounded-t-3xl p-0 pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{shown ? capitalize(dayTitle.format(utc(shown))) : "Détail du jour"}</SheetTitle>
            <SheetDescription>Réservations du jour</SheetDescription>
          </SheetHeader>
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-muted" aria-hidden />
          {detail(true)}
          <div className="shrink-0 border-t border-border/70 p-3">
            <SheetClose className="h-11 w-full rounded-xl bg-night text-sm font-medium text-ivory transition active:scale-[0.99]">
              Fermer
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
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
  // z-[1] : la barre passe au-dessus du trait entre deux jours (bordure de la case suivante),
  // sinon le séjour paraît coupé à chaque jour.
  const piece = (s: CalendarStay, style: React.CSSProperties) => (
    <span className="absolute inset-y-0 z-[1]" style={{ background: channelColor(s.channel), ...style }} />
  );
  // Nom du voyageur : au jour d'arrivée, ou en début de semaine pour un séjour commencé avant.
  // Il occupe toute la barre jusqu'au départ (milieu du jour de départ) ou jusqu'à la fin de la semaine.
  // Arrivée le dimanche : une demi-case ne suffit pas, le nom s'affiche le lundi suivant.
  const showLabel = label && current && ((current.arrival === day && weekday < 6) || weekday === 0);
  let labelLeft = "6px";
  let labelWidth = "0px";
  if (showLabel) {
    const nights = nightsBetween(day, current.departure);
    const end = weekday + nights <= 6 ? `(${nights * 100 + 50}% - 3px)` : `${(7 - weekday) * 100}%`;
    labelLeft = current.arrival === day ? "calc(50% + 9px)" : "6px";
    labelWidth = current.arrival === day ? `calc(${end} - 50% - 15px)` : `calc(${end} - 12px)`;
  }
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
          style={{ left: labelLeft, width: labelWidth }}
        >
          {current.guestName ?? channelLabel(current.channel)}
        </span>
      )}
    </span>
  );
}

type Activity = ReturnType<typeof dayActivity>;

/** Détail d'un jour : arrivées, séjours en cours et départs, avec les montants du séjour entier. */
function DayDetail({
  day,
  activity,
  units,
  single,
  today,
  sheet,
}: {
  day: string;
  activity: Activity;
  units: number;
  single: boolean;
  today: string;
  /** Panneau du bas (mobile) : la liste prend la hauteur restante et défile seule. */
  sheet: boolean;
}) {
  const { arrivals, staying, departures, occupied } = activity;
  const empty = !arrivals.length && !staying.length && !departures.length;
  return (
    <div className={cn("flex flex-col", sheet && "min-h-0 flex-1")}>
      <div className="shrink-0 border-b border-border/70 px-4 pt-4 pb-3.5">
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
      <div className={cn("overflow-y-auto overscroll-contain px-2 py-2", sheet ? "min-h-0 flex-1" : "max-h-[60vh]")}>
        {empty && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Aucun séjour ce jour-là.</p>}
        <Group title="Arrivées" icon={<ArrowDownRight className="size-3.5" />} stays={arrivals} day={day} />
        <Group title="En séjour" icon={<BedDouble className="size-3.5" />} stays={staying} day={day} />
        <Group title="Départs" icon={<ArrowUpRight className="size-3.5" />} stays={departures} day={day} />
      </div>
      {!empty && (
        <p className="shrink-0 border-t border-border/70 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
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
