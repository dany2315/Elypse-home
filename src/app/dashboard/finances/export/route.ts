import { requireSession } from "@/lib/auth";
import { cancelLabel, csvAmount, modeLabel, parseFilters, periodLabel, periodSlug } from "@/lib/finances/filters";
import { loadReport } from "@/lib/finances/load";
import { occupancy, type Totals } from "@/lib/finances/report";
import { buildSections, type ViewSection } from "@/lib/finances/views";

/** Export CSV de la vue affichée (mêmes filtres que /dashboard/finances). */
export async function GET(request: Request) {
  await requireSession();
  const filters = parseFilters(Object.fromEntries(new URL(request.url).searchParams));
  const report = await loadReport(filters);
  const { main, channels } = buildSections(report, filters);

  const header = [
    "Séjours",
    "Nuits",
    "Occupation (%)",
    "Chiffre d'affaires (€)",
    "dont ménage (€)",
    "Commissions (€)",
    "Frais de paiement (€)",
    "Remboursements (€)",
    "Taxe de séjour (€)",
    "TVA (€)",
    "Bénéfice (€)",
  ];
  const line = (label: string, t: Totals) => [
    label,
    String(t.stays),
    String(t.nights),
    occupancy(t) === null ? "" : (occupancy(t)! * 100).toFixed(1).replace(".", ","),
    csvAmount(t.gross),
    csvAmount(t.cleaning),
    csvAmount(t.commission),
    csvAmount(t.paymentFees),
    csvAmount(t.refunds),
    csvAmount(t.cityTax),
    csvAmount(t.vat),
    csvAmount(t.payout),
  ];
  const section = (s: ViewSection) => [
    [s.title],
    [s.firstColumn, ...header],
    ...s.rows.map((r) => line(r.label, r.totals)),
    line("Total", s.total),
    [],
  ];

  const rows: string[][] = [
    ["Elypse Home — Finances", periodLabel(filters)],
    ["Rattachement", modeLabel(filters.mode, filters.periode)],
    ["Annulations", cancelLabel(filters.annulations)],
    ["Bénéfice", "Chiffre d'affaires − commissions − frais de paiement − remboursements − taxe de séjour − TVA"],
    [],
    ...main.flatMap(section),
    ...section({ ...channels, total: channels.total }),
  ];

  const csv = "﻿" + rows.map((r) => r.map(escape).join(";")).join("\r\n");
  const name = `finances-${periodSlug(filters)}-${filters.mode}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

function escape(v: string) {
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
