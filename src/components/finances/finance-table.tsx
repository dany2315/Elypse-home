import { BookOpen } from "lucide-react";
import Link from "next/link";
import { eur, int, pct } from "@/lib/finances/filters";
import { occupancy, type Totals } from "@/lib/finances/report";
import { cn } from "@/lib/utils";

export type TableRow = { key: string; label: string; totals: Totals; muted?: boolean };

type Column = { key: keyof Totals; label: string; hint?: string; strong?: boolean; minus?: boolean };

/**
 * Colonnes du récapitulatif : le chiffre d'affaires (ce que les voyageurs ont payé), puis chaque
 * montant qui en sort, puis le bénéfice (ce qui reste). CA − colonnes « − » = bénéfice.
 */
const PLATFORM_COLUMNS: Column[] = [
  { key: "gross", label: "Chiffre d'affaires", hint: "Tout ce que les voyageurs ont payé : nuitées, ménage, frais de service, taxes (Revenus de location Hostaway)", strong: true },
  { key: "commission", label: "Commissions", hint: "Frais d'hôte et frais de service voyageur prélevés par la plateforme", minus: true },
  { key: "paymentFees", label: "Frais de paiement", hint: "Frais de traitement du paiement (Booking : 1,4 %)", minus: true },
  { key: "refunds", label: "Remboursements", hint: "Sommes rendues aux voyageurs (résolutions Airbnb)", minus: true },
  { key: "cityTax", label: "Taxe de séjour", hint: "Payée par le voyageur, reversée à la ville (par la plateforme ou par vous)", minus: true },
  { key: "vat", label: "TVA", hint: "TVA et autres taxes payées par le voyageur, à reverser à l'État", minus: true },
];
const WITH_CHARGES: Column[] = [
  ...PLATFORM_COLUMNS,
  { key: "cleaningCost", label: "Ménage (coût)", hint: "Ménage payé par vous, compté à chaque séjour (page Charges), TVA comprise", minus: true },
  { key: "otherCharges", label: "Charges", hint: "Vos charges mensuelles saisies (loyer, leasing mobilier, électricité…), TVA comprise", minus: true },
  {
    key: "profit",
    label: "Bénéfice",
    hint: "Ce qui reste réellement : chiffre d'affaires − commissions − frais de paiement − remboursements − taxes − ménage − charges",
    strong: true,
  },
];
/** Plateformes : les charges fixes ne s'y répartissent pas, le tableau s'arrête au net. */
const WITHOUT_CHARGES: Column[] = [
  ...PLATFORM_COLUMNS,
  { key: "payout", label: "Net avant charges", hint: "Chiffre d'affaires − commissions − frais de paiement − remboursements − taxes", strong: true },
];

export function FinanceTable({
  firstColumn,
  rows,
  total,
  showOccupancy = true,
  withCharges = true,
  livretLinks,
}: {
  firstColumn: string;
  rows: TableRow[];
  total: Totals;
  showOccupancy?: boolean;
  /** false : pas de colonne Charges, dernière colonne = net avant charges (tableau des plateformes). */
  withCharges?: boolean;
  /** Lien « Voir le livret » par ligne (clé de ligne → URL). */
  livretLinks?: Record<string, string>;
}) {
  const columns = withCharges ? WITH_CHARGES : WITHOUT_CHARGES;
  return (
    <div className="overflow-x-auto rounded-3xl border border-border/80 bg-card shadow-[0_1px_0_rgba(18,22,42,.04),0_20px_40px_-28px_rgba(18,22,42,.35)]">
      <table className="w-full min-w-[1340px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/80 bg-sand/40 text-left text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
            <th className="sticky left-0 bg-sand/40 px-4 py-3 backdrop-blur">{firstColumn}</th>
            <th className="px-3 py-3 text-right">Séjours</th>
            <th className="px-3 py-3 text-right">Nuits</th>
            {showOccupancy && (
              <th className="px-3 py-3 text-right" title="Nuits occupées / nuits du calendrier (nuits bloquées non déduites)">
                Occupation
              </th>
            )}
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-3 text-right" title={c.hint}>
                {c.minus && <span aria-hidden>− </span>}
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row
              key={r.key}
              label={r.label}
              totals={r.totals}
              columns={columns}
              showOccupancy={showOccupancy}
              muted={r.muted}
              livretHref={livretLinks?.[r.key]}
            />
          ))}
        </tbody>
        <tfoot>
          <Row label="Total" totals={total} columns={columns} showOccupancy={showOccupancy} isTotal />
        </tfoot>
      </table>
    </div>
  );
}

function Row({
  label,
  totals,
  columns,
  showOccupancy,
  isTotal,
  muted,
  livretHref,
}: {
  label: string;
  totals: Totals;
  columns: Column[];
  showOccupancy: boolean;
  isTotal?: boolean;
  muted?: boolean;
  livretHref?: string;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border/60 tabular-nums last:border-b-0",
        isTotal ? "border-t-2 border-t-gold/50 bg-night text-ivory" : "hover:bg-accent/40",
        muted && !isTotal && "text-muted-foreground",
      )}
    >
      <th
        scope="row"
        className={cn(
          "sticky left-0 px-4 py-3 text-left font-medium first-letter:uppercase",
          isTotal ? "bg-night font-serif text-base tracking-wide text-gold-light" : "bg-card",
        )}
      >
        <span className="flex items-center gap-2">
          <span className="first-letter:uppercase">{label}</span>
          {livretHref && (
            <Link
              href={livretHref}
              title="Voir le livret d'accueil de ce logement"
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gold/40 px-2 py-0.5 text-[11px] font-medium text-gold-deep transition hover:bg-accent"
            >
              <BookOpen className="size-3" aria-hidden /> Livret
            </Link>
          )}
        </span>
      </th>
      <td className="px-3 py-3 text-right">{int(totals.stays)}</td>
      <td className="px-3 py-3 text-right">{int(totals.nights)}</td>
      {showOccupancy && <td className="px-3 py-3 text-right">{pct(occupancy(totals))}</td>}
      {columns.map((c) => (
        <td
          key={c.key}
          className={cn(
            "px-3 py-3 text-right whitespace-nowrap",
            c.strong && (isTotal ? "font-semibold text-gold-light" : "font-semibold text-ink"),
            c.minus && !isTotal && !muted && "text-ink/70",
            c.strong && totals[c.key] < 0 && (isTotal ? "text-red-300" : "text-destructive"),
          )}
        >
          {eur(totals[c.key])}
        </td>
      ))}
    </tr>
  );
}
