import { Building2, ChevronDown, CircleSlash, Download, Receipt, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RankedBars, ShareBar, TrendChart } from "@/components/finances/finance-charts";
import { FinanceCalendar } from "@/components/finances/finance-calendar";
import { FinanceFiltersBar } from "@/components/finances/finance-filters";
import { FinanceTable } from "@/components/finances/finance-table";
import { ReservationTable } from "@/components/finances/reservation-table";
import { SyncButton } from "@/components/finances/sync-button";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { cancelLabel, eur, int, modeLabel, parseFilters, pct, periodLabel, todayInParis, toSearchParams } from "@/lib/finances/filters";
import { chargeCategoryLabel } from "@/lib/finances/charges";
import { occupancy, type Report } from "@/lib/finances/report";
import { loadCalendar, loadGroups, loadReport, loadSyncState, loadYears } from "@/lib/finances/load";
import { nextMonth, prevMonth } from "@/lib/finances/calendar";
import { bienBars, channelColors, channelShares, trendFilters, trendPoints } from "@/lib/finances/charts";
import { buildSections } from "@/lib/finances/views";

export const metadata: Metadata = { title: "Finances" };

// Durée maximale des server actions de la page (bouton « Actualiser depuis Hostaway »).
export const maxDuration = 300;

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });

export default async function FinancesPage(props: PageProps<"/dashboard/finances">) {
  await requireSession();
  const today = todayInParis();
  const filters = parseFilters(await props.searchParams, today);

  const trend = trendFilters(filters);
  const calendar = filters.vue === "calendrier";
  const [report, trendReport, groups, sync, years, calendarData] = await Promise.all([
    loadReport(filters),
    trend ? loadReport(trend.filters) : null,
    loadGroups(),
    loadSyncState(),
    loadYears(Number(today.slice(0, 4))),
    calendar ? loadCalendar(filters) : null,
  ]);
  const { main, channels } = buildSections(report, filters);
  const points = trendPoints(trendReport ?? report, trend?.highlight);
  // Lien « Voir le livret » (aperçu dans le tableau de bord) pour chaque bien relié à un livret.
  const livretLinks = Object.fromEntries(Object.entries(groups.livretOf).map(([bien, livret]) => [bien, `/dashboard/livrets/${livret}/apercu`]));
  const exportHref = `/dashboard/finances/export?${toSearchParams(filters)}`;
  // Liens du calendrier : mois voisins, mois en cours, et chaque bien seul.
  const hrefWith = (patch: Partial<typeof filters>) => `/dashboard/finances?${toSearchParams({ ...filters, ...patch })}`;
  const monthHref = (m: string) => hrefWith({ year: Number(m.slice(0, 4)), month: Number(m.slice(5, 7)) });

  return (
    <main className="mx-auto max-w-7xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="animate-rise">
          <p className="text-[11px] font-medium tracking-[0.3em] text-gold-deep uppercase">Gestion</p>
          <h1 className="mt-2 font-serif text-4xl leading-none text-ink sm:text-5xl">Finances</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Données Hostaway (lecture seule) ·{" "}
            {sync?.lastSyncAt ? (
              <>
                dernière synchronisation le {dateTime.format(sync.lastSyncAt)}
                {sync.lastSyncStatus === "error" && <span className="text-destructive"> (échec : {sync.lastSyncMessage})</span>}
                {sync.lastSyncStatus === "partial" && <span className="text-gold-deep"> (partielle)</span>}
              </>
            ) : (
              "jamais synchronisé"
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard/finances/charges">
              <Receipt /> Charges
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard/finances/biens">
              <Building2 /> Biens et listings
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={exportHref} download>
              <Download /> Export CSV
            </a>
          </Button>
          <SyncButton />
        </div>
      </div>

      <div className="gold-hairline my-8 h-px opacity-50" />

      <FinanceFiltersBar
        filters={filters}
        years={years}
        groups={groups.options}
        biens={groups.biens.map((b) => ({ id: b.id, name: b.name, excluded: groups.excluded.includes(b.id) }))}
      />

      {calendarData && (
        <div className="mt-6">
          <FinanceCalendar
            data={calendarData}
            today={today}
            prevHref={monthHref(prevMonth(calendarData.month))}
            nextHref={monthHref(nextMonth(calendarData.month))}
            todayHref={monthHref(today.slice(0, 7))}
            unitHrefs={Object.fromEntries(calendarData.legend.map((u) => [u.key, hrefWith({ bien: u.key })]))}
            allHref={hrefWith({ bien: "tous" })}
            selected={filters.bien === "tous" ? null : filters.bien}
          />
        </div>
      )}

      {/* items-start : ouvrir un détail n'étire pas les autres cartes. */}
      <section className="mt-8 grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Kpi
          label="Chiffre d'affaires"
          value={eur(report.total.gross)}
          note="Tout ce que les voyageurs ont payé"
          details={[
            ["dont frais de ménage", eur(report.total.cleaning)],
            ["dont taxes (séjour, TVA)", eur(report.total.cityTax + report.total.vat)],
          ]}
        />
        <Kpi
          label="Commissions et frais"
          value={`− ${eur(report.total.commission + report.total.paymentFees + report.total.refunds)}`}
          note="Retenus par les plateformes"
          details={[
            ["Commissions des plateformes", eur(report.total.commission)],
            ["Frais de paiement", eur(report.total.paymentFees)],
            ["Remboursements aux voyageurs", eur(report.total.refunds)],
          ]}
        />
        <Kpi
          label="Taxes à reverser"
          value={`− ${eur(report.total.cityTax + report.total.vat)}`}
          note="Payées par les voyageurs, pas à vous"
          details={[
            ["Taxe de séjour", eur(report.total.cityTax)],
            ["TVA", eur(report.total.vat)],
          ]}
        />
        <Kpi
          label="Vos charges"
          value={`− ${eur(report.total.charges)}`}
          note={report.charges.length ? "Loyer, leasing, ménage… TVA comprise" : "Aucune charge saisie sur la période"}
          details={report.charges.length ? chargeDetails(report) : undefined}
          footer={
            <Link href="/dashboard/finances/charges" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-gold-deep hover:underline">
              <Receipt className="size-3.5" aria-hidden /> {report.charges.length ? "Gérer les charges" : "Saisir vos charges"}
            </Link>
          }
        />
        <Kpi
          label="Bénéfice"
          value={eur(report.total.profit)}
          note="Ce qui reste réellement pour vous"
          accent
          negative={report.total.profit < 0}
          details={[
            ["Chiffre d'affaires", eur(report.total.gross)],
            ["− Commissions et frais", eur(report.total.commission + report.total.paymentFees + report.total.refunds)],
            ["− Taxes", eur(report.total.cityTax + report.total.vat)],
            ["= Net des plateformes", eur(report.total.payout)],
            ["− Vos charges", eur(report.total.charges)],
            ["= Bénéfice", eur(report.total.profit)],
          ]}
        />
      </section>

      {/* Activité : une seule bande, pas de cartes. */}
      <dl className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2 rounded-3xl border border-border/80 bg-card px-5 py-4">
        <Activity label="séjours" value={int(report.total.stays)} />
        <Activity label="nuitées" value={int(report.total.nights)} />
        <Activity label="d'occupation" value={pct(occupancy(report.total))} hint="Nuits occupées / nuits disponibles du calendrier" />
      </dl>

      <p className="mt-6 text-sm text-muted-foreground">
        <span className="font-medium text-ink first-letter:uppercase">{periodLabel(filters)}</span> · {modeLabel(filters.mode, filters.periode)} ·{" "}
        {cancelLabel(filters.annulations)}
        {cancelCounts(report.cancelledIncluded, report.cancelledExcluded)}
      </p>
      {report.excluded.length > 0 && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <CircleSlash className="size-4 shrink-0" aria-hidden />
          <span>
            Exclu{report.excluded.length > 1 ? "s" : ""} des calculs : {report.excluded.map((b) => b.name).join(", ")} (à
            changer dans le filtre « Biens », en haut)
          </span>
        </p>
      )}
      {filters.bien !== "tous" && groups.excluded.includes(filters.bien) && (
        <p className="mt-2 flex items-center gap-2 text-sm text-gold-deep">
          <CircleSlash className="size-4 shrink-0" aria-hidden /> Ce bien est exclu des calculs : il est affiché seul, mais n&apos;est pas
          compté dans le rapport de tous les biens.
        </p>
      )}
      {report.duplicates > 0 && (
        <p className="mt-2 flex items-center gap-2 text-sm text-gold-deep">
          <TriangleAlert className="size-4" /> {report.duplicates} réservation(s) en double ignorée(s) (même référence plateforme).
        </p>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        <TrendChart
          className="lg:col-span-5"
          title={trend ? "Évolution sur 12 mois" : "Évolution mois par mois"}
          subtitle="Hauteur = chiffre d'affaires, découpé en bénéfice + vos charges + commissions et frais + remboursements + taxes. Survolez une colonne pour le détail."
          points={points}
        />
        {filters.bien === "tous" && (
          <RankedBars className="lg:col-span-3" title="Bénéfice par bien" subtitle={periodLabel(filters)} items={bienBars(report)} />
        )}
        <ShareBar
          className={filters.bien === "tous" ? "lg:col-span-2" : "lg:col-span-5"}
          title="Chiffre d'affaires par plateforme"
          subtitle="Part du chiffre d'affaires"
          items={channelShares(report)}
        />
      </div>

      {filters.vue === "reservations" ? (
        <section className="mt-6">
          <h2 className="mb-1 font-serif text-2xl text-ink">Par réservation</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            « Net » = ce que chaque réservation rapporte après les plateformes et les taxes.
            {report.total.charges > 0 &&
              ` Le ménage payé à chaque séjour apparaît dans le détail de la réservation ; vos charges mensuelles (loyer, leasing…) ne sont pas réparties par réservation : elles sont déduites du bénéfice en haut de page.`}
          </p>
          <ReservationTable lines={report.reservations} channelColors={channelColors(report)} livretLinks={livretLinks} />
        </section>
      ) : (
        main.map((s) => (
          <section key={s.id} className="mt-6">
            <h2 className="mb-3 font-serif text-2xl text-ink">{s.title}</h2>
            <FinanceTable
              firstColumn={s.firstColumn}
              rows={s.rows}
              total={s.total}
              livretLinks={s.id === "biens" ? livretLinks : undefined}
            />
          </section>
        ))
      )}

      <section className="mt-10">
        <h2 className="mb-3 font-serif text-2xl text-ink">{channels.title}</h2>
        {channels.rows.length ? (
          <FinanceTable firstColumn={channels.firstColumn} rows={channels.rows} total={channels.total} showOccupancy={false} withCharges={false} />
        ) : (
          <p className="text-sm text-muted-foreground">Aucun séjour sur la période.</p>
        )}
      </section>

      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        Chiffre d&apos;affaires : tout ce que les voyageurs ont payé (nuitées, ménage, frais de service, taxe de séjour,
        TVA), comme les « Revenus de location » Hostaway. Net des plateformes = chiffre d&apos;affaires − commissions −
        frais de paiement − remboursements − taxe de séjour − TVA. Bénéfice = net des plateformes − vos charges (saisies
        dans « Charges », TVA comprise, comptées au jour près : du 1er au 15 d&apos;un mois de 30 jours, la moitié du
        loyer). Les frais de ménage sont payés par les voyageurs et restent dans le bénéfice. Occupation : nuits
        occupées / nuits du calendrier (nuits bloquées non déduites).
      </p>
    </main>
  );
}

/** « (2 comptées, 5 ignorées) » pour les annulations de la période. */
function cancelCounts(included: number, excluded: number) {
  const parts = [
    included > 0 && `${included} comptée${included > 1 ? "s" : ""}`,
    excluded > 0 && `${excluded} ignorée${excluded > 1 ? "s" : ""}`,
  ].filter(Boolean);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

type Detail = [label: string, value: string];

/** Charges de la période par type (Loyer, Leasing…), puis la TVA comprise. */
function chargeDetails(report: Report): Detail[] {
  const byCategory = new Map<string, { amount: number; stays: number }>();
  for (const c of report.charges) {
    const e = byCategory.get(c.category) ?? { amount: 0, stays: 0 };
    e.amount += c.ht + c.vat;
    e.stays += c.stays ?? 0;
    byCategory.set(c.category, e);
  }
  return [
    ...[...byCategory]
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([c, e]): Detail => [e.stays ? `${chargeCategoryLabel(c)} (${int(e.stays)} séjour${e.stays > 1 ? "s" : ""})` : chargeCategoryLabel(c), eur(e.amount)]),
    ["dont TVA", eur(report.total.chargesVat)],
  ];
}

function Activity({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2" title={hint}>
      <dt className="order-2 text-sm text-muted-foreground">{label}</dt>
      <dd className="order-1 font-serif text-2xl text-ink tabular-nums">{value}</dd>
    </div>
  );
}

/** Carte chiffre clé ; « Voir le détail » déplie la décomposition du montant (accordéon natif). */
function Kpi({
  label,
  value,
  accent,
  negative,
  note,
  details,
  footer,
}: {
  label: string;
  value: string;
  accent?: boolean;
  /** Montant négatif (bénéfice) : en rouge. */
  negative?: boolean;
  note?: string;
  details?: Detail[];
  footer?: React.ReactNode;
}) {
  return (
    <div className={accent ? "rounded-3xl border border-gold/40 bg-night p-5 text-ivory" : "rounded-3xl border border-border/80 bg-card p-5"}>
      <p className={`text-[10px] font-semibold tracking-[0.2em] uppercase ${accent ? "text-gold-light" : "text-muted-foreground"}`}>{label}</p>
      <p className={`mt-2 font-serif text-3xl tabular-nums ${negative ? (accent ? "text-red-300" : "text-destructive") : accent ? "text-ivory" : "text-ink"}`}>
        {value}
      </p>
      {note && <p className={`mt-1.5 text-xs ${accent ? "text-ivory/70" : "text-muted-foreground"}`}>{note}</p>}
      {details && (
        <details className="group mt-3">
          <summary
            className={`flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium outline-none select-none focus-visible:ring-2 focus-visible:ring-gold/60 [&::-webkit-details-marker]:hidden ${accent ? "text-gold-light" : "text-gold-deep"}`}
          >
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
            <span className="group-open:hidden">Voir le détail</span>
            <span className="hidden group-open:inline">Masquer le détail</span>
          </summary>
          <dl className={`mt-2 divide-y text-sm ${accent ? "divide-ivory/15" : "divide-border/70"}`}>
            {details.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 py-1.5">
                <dt className={accent ? "text-ivory/75" : "text-muted-foreground"}>{k}</dt>
                <dd className={`font-medium whitespace-nowrap tabular-nums ${accent ? "text-ivory" : "text-ink"}`}>{v}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {footer}
    </div>
  );
}
