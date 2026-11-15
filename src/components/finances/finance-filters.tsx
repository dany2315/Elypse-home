"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTH_NAMES, toSearchParams, validDate, type FinanceFilters, type Periode } from "@/lib/finances/filters";
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

        {pending && <Loader2 className="mb-2 size-4 animate-spin text-gold-deep" aria-label="Chargement" />}
      </div>

      <div className="mt-4 grid gap-4 border-t border-border/70 pt-4 lg:grid-cols-2 lg:gap-6">
        <Choice
          title="Dans quel mois compter un séjour ?"
          options={MODES}
          value={filters.mode}
          onChange={(mode) => update({ mode })}
        />
        <Choice
          title="Réservations annulées"
          options={CANCEL_FILTERS}
          value={filters.annulations}
          onChange={(annulations) => update({ annulations })}
        />
      </div>
    </div>
  );
}

/** Choix expliqué : boutons, puis une phrase qui dit ce que fait l'option active. */
function Choice<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { value: T; label: string; hint: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const active = options.find((o) => o.value === value) ?? options[0];
  return (
    <fieldset className="min-w-0">
      <legend className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">{title}</legend>
      <div className="mt-1.5 grid grid-cols-3 rounded-lg border border-input p-0.5" role="radiogroup" aria-label={title}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-8 rounded-md px-2 py-1 text-xs leading-tight font-medium transition sm:text-sm",
              o.value === value ? "bg-ink text-ivory" : "text-ink/70 hover:bg-accent",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{active.hint}</p>
    </fieldset>
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
