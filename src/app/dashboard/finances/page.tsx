import { Building2, Download, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FinanceFiltersBar } from "@/components/finances/finance-filters";
import { FinanceTable } from "@/components/finances/finance-table";
import { SyncButton } from "@/components/finances/sync-button";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { eur, modeLabel, parseFilters, periodLabel, todayInParis, toSearchParams } from "@/lib/finances/filters";
import { loadGroups, loadReport, loadSyncState, loadYears } from "@/lib/finances/load";
import { buildSections } from "@/lib/finances/views";

export const metadata: Metadata = { title: "Finances" };

// Durée maximale des server actions de la page (bouton « Actualiser depuis Hostaway »).
export const maxDuration = 300;

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });

export default async function FinancesPage(props: PageProps<"/dashboard/finances">) {
  await requireSession();
  const today = todayInParis();
  const filters = parseFilters(await props.searchParams, today);

  const [report, groups, sync, years] = await Promise.all([
    loadReport(filters),
    loadGroups(),
    loadSyncState(),
    loadYears(Number(today.slice(0, 4))),
  ]);
  const { main, channels } = buildSections(report, filters);
  const exportHref = `/dashboard/finances/export?${toSearchParams(filters)}`;

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

      <FinanceFiltersBar filters={filters} years={years} groups={groups.options} />

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Revenus de location" value={eur(report.total.revenue)} />
        <Kpi label="Commissions et frais" value={eur(report.total.commission + report.total.paymentFees)} />
        <Kpi label="Versement total" value={eur(report.total.payout)} accent />
        <Kpi label="Taxe de séjour" value={eur(report.total.cityTax)} />
      </section>

      <p className="mt-6 text-sm text-muted-foreground">
        <span className="font-medium text-ink first-letter:uppercase">{periodLabel(filters)}</span> · {modeLabel(filters.mode, filters.periode)}
        {report.cancelledIncluded > 0 && ` · ${report.cancelledIncluded} annulation(s) incluse(s)`}
        {report.cancelledExcluded > 0 && ` · ${report.cancelledExcluded} annulation(s) exclue(s)`}
      </p>
      {report.duplicates > 0 && (
        <p className="mt-2 flex items-center gap-2 text-sm text-gold-deep">
          <TriangleAlert className="size-4" /> {report.duplicates} réservation(s) en double ignorée(s) (même référence plateforme).
        </p>
      )}

      {main.map((s) => (
        <section key={s.id} className="mt-6">
          <h2 className="mb-3 font-serif text-2xl text-ink">{s.title}</h2>
          <FinanceTable firstColumn={s.firstColumn} rows={s.rows} total={s.total} showOccupancy={filters.occ} />
        </section>
      ))}

      <section className="mt-10">
        <h2 className="mb-3 font-serif text-2xl text-ink">{channels.title}</h2>
        {channels.rows.length ? (
          <FinanceTable firstColumn={channels.firstColumn} rows={channels.rows} total={channels.total} showOccupancy={false} />
        ) : (
          <p className="text-sm text-muted-foreground">Aucun séjour sur la période.</p>
        )}
      </section>

      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        Revenus de location : montant payé par le voyageur, hors taxe de séjour. Versement total = revenus − commissions −
        frais de paiement, avant impôts. Ménage : uniquement le montant présent dans la réservation Hostaway. Occupation :
        nuits occupées / nuits du calendrier (les nuits bloquées ne sont pas déduites).
      </p>
    </main>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={
        accent
          ? "rounded-3xl border border-gold/40 bg-night p-5 text-ivory"
          : "rounded-3xl border border-border/80 bg-card p-5"
      }
    >
      <p className={`text-[10px] font-semibold tracking-[0.2em] uppercase ${accent ? "text-gold-light" : "text-muted-foreground"}`}>
        {label}
      </p>
      <p className={`mt-2 font-serif text-3xl tabular-nums ${accent ? "text-ivory" : "text-ink"}`}>{value}</p>
    </div>
  );
}
