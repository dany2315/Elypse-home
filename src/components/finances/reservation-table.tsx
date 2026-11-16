"use client";

/**
 * Vue « Par réservation » : chaque réservation comptée dans la période, avec recherche,
 * filtre par plateforme et par statut, tri et détail dépliable. Montants = part de la
 * réservation qui tombe dans la période (selon le mode de rattachement).
 */
import { ChevronDown, Search } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { eur, int } from "@/lib/finances/filters";
import { channelLabel, statusLabel, type ReservationLine, type Totals } from "@/lib/finances/report";
import { cn } from "@/lib/utils";

type Sort = "arrivee" | "benefice" | "ca";
const SORTS: { value: Sort; label: string }[] = [
  { value: "arrivee", label: "Date d'arrivée" },
  { value: "benefice", label: "Bénéfice" },
  { value: "ca", label: "Chiffre d'affaires" },
];
const PAGE = 50;

const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const fullFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const day = (d: string) => dayFmt.format(new Date(`${d}T00:00:00Z`));
const full = (d: string) => fullFmt.format(new Date(`${d}T00:00:00Z`));

const plural = (n: number) => (n > 1 ? "s" : "");
/**
 * « 5 nuits », ou pour un séjour à cheval sur la période « 2 nuits sur 3 dans la période » :
 * seules ces nuits (et la même part des montants) sont comptées.
 */
const nightsText = (l: ReservationLine) =>
  l.prorata ? `${l.totals.nights} nuit${plural(l.totals.nights)} sur ${l.stayNights} dans la période` : `${l.stayNights} nuit${plural(l.stayNights)}`;

const fees = (t: Totals) => t.commission + t.paymentFees + t.refunds;
const taxes = (t: Totals) => t.cityTax + t.vat;

export function ReservationTable({
  lines,
  channelColors,
}: {
  lines: ReservationLine[];
  /** Couleur de chaque plateforme (mêmes couleurs que le graphique par plateforme). */
  channelColors: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<string>("toutes");
  const [onlyCancelled, setOnlyCancelled] = useState(false);
  const [sort, setSort] = useState<Sort>("arrivee");
  const [open, setOpen] = useState<number | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const channels = useMemo(() => {
    const count = new Map<string, number>();
    for (const l of lines) count.set(l.channel, (count.get(l.channel) ?? 0) + 1);
    return [...count].sort((a, b) => b[1] - a[1]);
  }, [lines]);
  const cancelledCount = lines.filter((l) => l.status === "cancelled").length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = lines.filter(
      (l) =>
        (channel === "toutes" || l.channel === channel) &&
        (!onlyCancelled || l.status === "cancelled") &&
        (!q || l.groupName.toLowerCase().includes(q) || (l.guestName ?? "").toLowerCase().includes(q) || (l.reference ?? "").toLowerCase().includes(q) || String(l.id).includes(q)),
    );
    if (sort === "benefice") list.sort((a, b) => b.totals.payout - a.totals.payout);
    else if (sort === "ca") list.sort((a, b) => b.totals.gross - a.totals.gross);
    return list;
  }, [lines, query, channel, onlyCancelled, sort]);

  const sum = useMemo(() => {
    const t = { gross: 0, fees: 0, taxes: 0, payout: 0, nights: 0 };
    for (const l of shown) {
      t.gross += l.totals.gross;
      t.fees += fees(l.totals);
      t.taxes += taxes(l.totals);
      t.payout += l.totals.payout;
      t.nights += l.totals.nights;
    }
    return t;
  }, [shown]);

  const visible = shown.slice(0, limit);
  const toggle = (id: number) => setOpen(open === id ? null : id);

  return (
    <div className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-[0_1px_0_rgba(18,22,42,.04),0_20px_40px_-28px_rgba(18,22,42,.35)]">
      {/* Barre d'outils */}
      <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative lg:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Voyageur, bien ou référence"
            aria-label="Rechercher une réservation par voyageur, bien ou référence"
            className="h-9 pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={channel === "toutes"} onClick={() => setChannel("toutes")}>
            Toutes <Count>{lines.length}</Count>
          </Chip>
          {channels.map(([c, n]) => (
            <Chip key={c} active={channel === c} onClick={() => setChannel(channel === c ? "toutes" : c)}>
              <span className="size-2 rounded-full" style={{ background: channelColors[c] ?? "#a9aebd" }} aria-hidden />
              {channelLabel(c)} <Count>{n}</Count>
            </Chip>
          ))}
          {cancelledCount > 0 && (
            <Chip active={onlyCancelled} onClick={() => setOnlyCancelled(!onlyCancelled)}>
              Annulées <Count>{cancelledCount}</Count>
            </Chip>
          )}
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground lg:ml-3">
            Trier par
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">Aucune réservation ne correspond.</p>
      ) : (
        <>
          {/* Bureau : tableau */}
          <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-sand/40 text-left text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                <th className="px-4 py-3">Séjour</th>
                <th className="px-3 py-3">Voyageur</th>
                <th className="px-3 py-3">Bien</th>
                <th className="px-3 py-3">Plateforme</th>
                <th className="px-3 py-3 text-right">Chiffre d&apos;affaires</th>
                <th className="px-3 py-3 text-right">− Commissions et frais</th>
                <th className="px-3 py-3 text-right">− Taxes</th>
                <th className="px-3 py-3 text-right">Bénéfice</th>
                <th className="w-10" aria-label="Détail" />
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => {
                const expanded = open === l.id;
                return (
                  <Fragment key={l.id}>
                    <tr
                      onClick={() => toggle(l.id)}
                      className={cn(
                        "cursor-pointer border-b border-border/60 tabular-nums transition hover:bg-accent/40",
                        expanded && "bg-accent/40",
                        l.status === "cancelled" && "text-muted-foreground",
                      )}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium whitespace-nowrap text-ink">
                          {day(l.arrival)} → {day(l.departure)}
                        </span>
                        <span className={cn("mt-0.5 flex items-center gap-1.5 text-xs", l.prorata ? "text-gold-deep" : "text-muted-foreground")}>
                          {nightsText(l)}
                          {l.status !== "new" && <StatusBadge status={l.status} />}
                        </span>
                      </td>
                      <td className="max-w-44 px-3 py-3">
                        <GuestName name={l.guestName} />
                      </td>
                      <td className="max-w-44 truncate px-3 py-3 text-ink/85">{l.groupName}</td>
                      <td className="px-3 py-3">
                        <ChannelTag channel={l.channel} color={channelColors[l.channel]} />
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">{eur(l.totals.gross)}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap text-ink/70">{eur(fees(l.totals))}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap text-ink/70">{eur(taxes(l.totals))}</td>
                      <td className="px-3 py-3 text-right font-semibold whitespace-nowrap text-ink">{eur(l.totals.payout)}</td>
                      <td className="pr-4">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={expanded ? "Masquer le détail" : "Voir le détail"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(l.id);
                          }}
                          className="grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-gold/60"
                        >
                          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-border/60 bg-sand/25">
                        <td colSpan={9} className="px-4 py-4">
                          <Detail line={l} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-t-gold/50 bg-night text-ivory tabular-nums">
                <th scope="row" colSpan={4} className="px-4 py-3 text-left font-serif text-base tracking-wide text-gold-light">
                  {int(shown.length)} réservation{shown.length > 1 ? "s" : ""} · {int(sum.nights)} nuits
                </th>
                <td className="px-3 py-3 text-right whitespace-nowrap">{eur(sum.gross)}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">{eur(sum.fees)}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">{eur(sum.taxes)}</td>
                <td className="px-3 py-3 text-right font-semibold whitespace-nowrap text-gold-light">{eur(sum.payout)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          </div>

          {/* Mobile : une ligne par réservation, détail au toucher */}
          <ul className="divide-y divide-border/60 lg:hidden">
            {visible.map((l) => {
              const expanded = open === l.id;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => toggle(l.id)}
                    className={cn("flex w-full items-start gap-3 px-4 py-3 text-left outline-none focus-visible:bg-accent/40", expanded && "bg-accent/40")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">
                        {l.guestName ?? <span className="font-normal text-muted-foreground italic">Nom effacé par la plateforme</span>}
                      </span>
                      <span className="block text-sm text-ink/80">
                        {day(l.arrival)} → {day(l.departure)}
                      </span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: channelColors[l.channel] ?? "#a9aebd" }} aria-hidden />
                        <span className="truncate">
                          {l.groupName}
                          {!l.prorata && ` · ${nightsText(l)}`}
                        </span>
                        {l.status !== "new" && <StatusBadge status={l.status} />}
                      </span>
                      {l.prorata && <span className="mt-0.5 block text-xs text-gold-deep">{nightsText(l)}</span>}
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="block font-semibold text-ink">{eur(l.totals.payout)}</span>
                      <span className="block text-[11px] text-muted-foreground">sur {eur(l.totals.gross)}</span>
                    </span>
                    <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden />
                  </button>
                  {expanded && (
                    <div className="bg-sand/25 px-4 pt-1 pb-4">
                      <Detail line={l} />
                    </div>
                  )}
                </li>
              );
            })}
            <li className="flex items-baseline justify-between gap-3 bg-night px-4 py-3 text-ivory tabular-nums">
              <span className="font-serif text-gold-light">
                {int(shown.length)} réservation{shown.length > 1 ? "s" : ""}
              </span>
              <span className="text-right">
                <span className="block font-semibold text-gold-light">{eur(sum.payout)}</span>
                <span className="block text-[11px] text-ivory/70">sur {eur(sum.gross)}</span>
              </span>
            </li>
          </ul>

          {shown.length > limit && (
            <div className="border-t border-border/70 p-3 text-center">
              <button
                type="button"
                onClick={() => setLimit(limit + PAGE)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gold-deep outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-gold/60"
              >
                Afficher {Math.min(PAGE, shown.length - limit)} réservations de plus ({int(shown.length - limit)} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Détail d'une réservation : d'où vient le bénéfice, ligne par ligne. */
function Detail({ line: l }: { line: ReservationLine }) {
  const t = l.totals;
  const rows: [string, string, boolean?][] = [
    ["Chiffre d'affaires", eur(t.gross), true],
    ["dont frais de ménage", eur(t.cleaning)],
    ["− Commissions de la plateforme", eur(t.commission)],
    ["− Frais de paiement", eur(t.paymentFees)],
    ["− Remboursements", eur(t.refunds)],
    ["− Taxe de séjour", eur(t.cityTax)],
    ["− TVA", eur(t.vat)],
    ["= Bénéfice", eur(t.payout), true],
  ];
  return (
    <div className="grid gap-x-10 gap-y-4 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <dl className="divide-y divide-border/70 text-sm">
        {rows.map(([k, v, strong]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className={strong ? "font-medium text-ink" : "text-muted-foreground"}>{k}</dt>
            <dd className={cn("whitespace-nowrap tabular-nums", strong ? "font-semibold text-ink" : "text-ink/80")}>{v}</dd>
          </div>
        ))}
      </dl>
      <dl className="grid content-start gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Info label="Voyageur" value={l.guestName ?? "Nom effacé par la plateforme après le séjour"} />
        <Info label="Séjour" value={`${full(l.arrival)} → ${full(l.departure)}`} />
        <Info label="Nuits" value={nightsText(l)} />
        <Info label="Plateforme" value={channelLabel(l.channel)} />
        <Info label="Statut" value={statusLabel(l.status)} />
        {l.reservationDate && <Info label="Réservée le" value={full(l.reservationDate)} />}
        <Info label="Référence" value={l.reference ? `${l.reference} · Hostaway ${l.id}` : `Hostaway ${l.id}`} />
      </dl>
      {l.prorata && (
        <p className="text-xs text-muted-foreground md:col-span-2">
          Ce séjour commence ou finit en dehors de la période choisie : seules les {l.totals.nights} nuit{plural(l.totals.nights)} passée
          {plural(l.totals.nights)} dans la période sont comptées ici, avec la même part des montants ({l.totals.nights}/{l.stayNights}). Le reste
          compte dans la période voisine. Le ménage compte au jour d&apos;arrivée. Pour voir le séjour entier, choisissez « Date d&apos;arrivée ».
        </p>
      )}
    </div>
  );
}

function GuestName({ name }: { name: string | null }) {
  return name ? (
    <span className="block truncate font-medium text-ink" title={name}>
      {name}
    </span>
  ) : (
    <span className="text-xs text-muted-foreground italic" title="Airbnb efface le nom du voyageur quelque temps après le séjour">
      Nom effacé
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 break-words text-ink">{value}</dd>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
        active ? "border-ink bg-ink text-ivory" : "border-input text-ink/75 hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

const Count = ({ children }: { children: React.ReactNode }) => <span className="text-xs opacity-60 tabular-nums">{children}</span>;

function ChannelTag({ channel, color }: { channel: string; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink/85">
      <span className="size-2 rounded-full" style={{ background: color ?? "#a9aebd" }} aria-hidden />
      {channelLabel(channel)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase",
        status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-gold/15 text-gold-deep",
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
