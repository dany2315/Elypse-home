"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { modeLabel, MONTH_NAMES, toSearchParams, validDate, type FinanceFilters, type Periode } from "@/lib/finances/filters";
import { CANCEL_FILTERS, MODES } from "@/lib/finances/report";
import { cn } from "@/lib/utils";

const PERIODES: { value: Periode; label: string }[] = [
  { value: "mois", label: "Mois" },
  { value: "annee", label: "Année" },
  { value: "dates", label: "Dates" },
];

type Props = {
  filters: FinanceFilters;
  years: number[];
  groups: { key: string; name: string }[];
};

export function FinanceFiltersBar({ filters, years, groups }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function update(patch: Partial<FinanceFilters>) {
    const next = { ...filters, ...patch };
    startTransition(() => router.push(`${pathname}?${toSearchParams(next)}`, { scroll: false }));
  }

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-[0_1px_0_rgba(18,22,42,.04),0_20px_40px_-28px_rgba(18,22,42,.35)] sm:p-5">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <Field label="Période">
          <div className="inline-flex h-8 rounded-lg border border-input p-0.5">
            {PERIODES.map(({ value: p, label }) => (
              <button
                key={p}
                type="button"
                onClick={() => update({ periode: p })}
                className={cn(
                  "rounded-md px-3 text-sm font-medium transition",
                  filters.periode === p ? "bg-ink text-ivory" : "text-ink/70 hover:bg-accent",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        {filters.periode === "mois" && (
          <Field label="Mois">
            <Select value={String(filters.month)} onValueChange={(v) => update({ month: Number(v) })}>
              <SelectTrigger className="w-36 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)} className="capitalize">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {filters.periode !== "dates" && (
          <Field label="Année">
            <Select value={String(filters.year)} onValueChange={(v) => update({ year: Number(v) })}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {filters.periode === "dates" && (
          <>
            <Field label="Du">
              <Input
                type="date"
                value={filters.from}
                max={filters.to}
                onChange={(e) => validDate(e.target.value) && update({ from: e.target.value })}
                className="h-8 w-40"
                aria-label="Date de début (incluse)"
              />
            </Field>
            <Field label="Au (inclus)">
              <Input
                type="date"
                value={filters.to}
                min={filters.from}
                onChange={(e) => validDate(e.target.value) && update({ to: e.target.value })}
                className="h-8 w-40"
                aria-label="Date de fin (incluse)"
              />
            </Field>
          </>
        )}

        <Field label="Bien">
          <Select value={filters.bien} onValueChange={(v) => update({ bien: v })}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous les biens</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.key} value={g.key}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Rattachement">
          <Select value={filters.mode} onValueChange={(v) => update({ mode: v as FinanceFilters["mode"] })}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {modeLabel(m.value, filters.periode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Annulations">
          <Select
            value={filters.annulations}
            onValueChange={(v) => update({ annulations: v as FinanceFilters["annulations"] })}
          >
            <SelectTrigger className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CANCEL_FILTERS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <label className="flex h-8 cursor-pointer items-center gap-2 text-sm text-ink/80">
          <Switch checked={filters.occ} onCheckedChange={(v) => update({ occ: v })} />
          Occupation
        </label>

        {pending && <Loader2 className="mb-2 size-4 animate-spin text-gold-deep" aria-label="Chargement" />}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">{label}</Label>
      {children}
    </div>
  );
}
