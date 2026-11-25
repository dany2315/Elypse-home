import { requireSession } from "@/lib/auth";
import { cancelLabel, csvAmount, modeLabel, parseFilters, periodLabel, periodSlug } from "@/lib/finances/filters";
import { loadReport } from "@/lib/finances/load";
import { chargeCategoryLabel } from "@/lib/finances/charges";
import { channelLabel, occupancy, statusLabel, type ChargeLine, type ReservationLine, type Totals } from "@/lib/finances/report";
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
    "dont ménage payé par les voyageurs (€)",
    "Commissions (€)",
    "Frais de paiement (€)",
    "Remboursements (€)",
    "Taxe de séjour (€)",
    "TVA (€)",
    "Net avant charges (€)",
    "Charges HT (€)",
    "TVA sur charges (€)",
    "Charges TTC (€)",
    "dont ménage, votre coût (€)",
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
    csvAmount(t.chargesHT),
    csvAmount(t.chargesVat),
    csvAmount(t.charges),
    csvAmount(t.cleaningCost),
    csvAmount(t.profit),
  ];
  const section = (s: ViewSection) => [
    [s.title],
    [s.firstColumn, ...header],
    ...s.rows.map((r) => line(r.label, r.totals)),
    line("Total", s.total),
    [],
  ];

  const perReservation = (lines: ReservationLine[]) => [
    ["Par réservation"],
    [
      "Arrivée",
      "Départ",
      "Voyageur",
      "Bien",
      "Plateforme",
      "Statut",
      "Référence",
      "Id Hostaway",
      "Nuits comptées",
      "Nuits du séjour",
      "Chiffre d'affaires (€)",
      "dont ménage payé par le voyageur (€)",
      "Commissions (€)",
      "Frais de paiement (€)",
      "Remboursements (€)",
      "Taxe de séjour (€)",
      "TVA (€)",
      "Net avant charges (€)",
      "Ménage, votre coût (€)",
    ],
    ...lines.map((l) => [
      l.arrival,
      l.departure,
      l.guestName ?? "",
      l.groupName,
      channelLabel(l.channel),
      statusLabel(l.status),
      l.reference ?? "",
      String(l.id),
      String(l.totals.nights),
      String(l.stayNights),
      csvAmount(l.totals.gross),
      csvAmount(l.totals.cleaning),
      csvAmount(l.totals.commission),
      csvAmount(l.totals.paymentFees),
      csvAmount(l.totals.refunds),
      csvAmount(l.totals.cityTax),
      csvAmount(l.totals.vat),
      csvAmount(l.totals.payout),
      csvAmount(l.totals.cleaningCost),
    ]),
    [],
  ];

  const perCharge = (charges: ChargeLine[]) =>
    charges.length
      ? [
          ["Charges de la période"],
          ["Bien", "Charge", "Type", "HT (€)", "TVA (€)", "TTC (€)"],
          ...charges.map((c) => [c.bienName, c.label, chargeCategoryLabel(c.category), csvAmount(c.ht), csvAmount(c.vat), csvAmount(c.ht + c.vat)]),
          ["Total", "", "", csvAmount(report.total.chargesHT), csvAmount(report.total.chargesVat), csvAmount(report.total.charges)],
          [],
        ]
      : [];

  const rows: string[][] = [
    ["Elypse Home — Finances", periodLabel(filters)],
    ["Rattachement", modeLabel(filters.mode, filters.periode)],
    ["Annulations", cancelLabel(filters.annulations)],
    ["Net avant charges", "Chiffre d'affaires − commissions − frais de paiement − remboursements − taxe de séjour − TVA"],
    ["Bénéfice", "Net avant charges − charges TTC (charges saisies, comptées au jour près)"],
    ...(report.excluded.length ? [["Biens exclus des calculs", report.excluded.map((b) => b.name).join(", ")]] : []),
    [],
    ...(filters.vue === "reservations" ? perReservation(report.reservations) : main.flatMap(section)),
    ...perCharge(report.charges),
    ...section({ ...channels, total: channels.total }),
  ];

  const csv = "﻿" + rows.map((r) => r.map(escape).join(";")).join("\r\n");
  const name = `finances-${periodSlug(filters)}-${filters.mode}${filters.vue === "reservations" ? "-reservations" : ""}.csv`;
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
