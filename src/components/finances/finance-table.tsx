import { eur, int, pct } from "@/lib/finances/filters";
import { occupancy, type Totals } from "@/lib/finances/report";
import { cn } from "@/lib/utils";

export type TableRow = { key: string; label: string; totals: Totals; muted?: boolean };

/** Colonnes du récapitulatif (ordre validé avec l'équipe). */
const AMOUNT_COLUMNS: { key: keyof Totals; label: string; hint?: string; strong?: boolean }[] = [
  { key: "revenue", label: "Revenus de location", hint: "Payé par le voyageur, hors taxe de séjour" },
  { key: "commission", label: "Commissions", hint: "Commissions des plateformes (Airbnb, Booking…)" },
  { key: "paymentFees", label: "Frais de paiement", hint: "Frais de traitement du paiement" },
  { key: "payout", label: "Versement total", hint: "Revenus − commissions − frais de paiement, avant impôts", strong: true },
  { key: "cityTax", label: "Taxe de séjour", hint: "City Tax" },
  { key: "cleaning", label: "Ménage", hint: "Frais de ménage facturés dans la réservation" },
];

export function FinanceTable({
  firstColumn,
  rows,
  total,
  showOccupancy,
}: {
  firstColumn: string;
  rows: TableRow[];
  total: Totals;
  showOccupancy: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-border/80 bg-card shadow-[0_1px_0_rgba(18,22,42,.04),0_20px_40px_-28px_rgba(18,22,42,.35)]">
      <table className="w-full min-w-[980px] border-collapse text-sm">
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
            {AMOUNT_COLUMNS.map((c) => (
              <th key={c.key} className="px-3 py-3 text-right" title={c.hint}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.key} label={r.label} totals={r.totals} showOccupancy={showOccupancy} muted={r.muted} />
          ))}
        </tbody>
        <tfoot>
          <Row label="Total" totals={total} showOccupancy={showOccupancy} isTotal />
        </tfoot>
      </table>
    </div>
  );
}

function Row({
  label,
  totals,
  showOccupancy,
  isTotal,
  muted,
}: {
  label: string;
  totals: Totals;
  showOccupancy: boolean;
  isTotal?: boolean;
  muted?: boolean;
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
        {label}
      </th>
      <td className="px-3 py-3 text-right">{int(totals.stays)}</td>
      <td className="px-3 py-3 text-right">{int(totals.nights)}</td>
      {showOccupancy && <td className="px-3 py-3 text-right">{pct(occupancy(totals))}</td>}
      {AMOUNT_COLUMNS.map((c) => (
        <td
          key={c.key}
          className={cn(
            "px-3 py-3 text-right whitespace-nowrap",
            c.strong && (isTotal ? "font-semibold text-gold-light" : "font-semibold text-ink"),
          )}
        >
          {eur(totals[c.key])}
        </td>
      ))}
    </tr>
  );
}
