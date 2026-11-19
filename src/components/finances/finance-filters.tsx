"use client";

import { ArrowLeft, Building2, ChevronDown, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setBienExcluded } from "@/app/dashboard/finances/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MONTH_NAMES, toSearchParams, validDate, VUES, type FinanceFilters, type Periode } from "@/lib/finances/filters";
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
  /** Biens (regroupements) avec leur état : compté ou exclu des calculs. */
  biens: CountedBien[];
};

type CountedBien = { id: string; name: string; excluded: boolean };

export function FinanceFiltersBar({ filters, years, groups, biens }: Props) {
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

        <Field label="Biens">
          <BiensFilter
            biens={biens}
            others={groups.filter((g) => !biens.some((b) => b.id === g.key))}
            selected={filters.bien}
            onSelect={(bien) => update({ bien })}
          />
        </Field>

        <Field label="Affichage">
          <div className="inline-flex h-8 rounded-lg border border-input p-0.5">
            {VUES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={filters.vue === value}
                onClick={() => update({ vue: value })}
                className={cn(
                  "rounded-md px-3 text-sm font-medium whitespace-nowrap transition",
                  filters.vue === value ? "bg-ink text-ivory" : "text-ink/70 hover:bg-accent",
                )}
              >
                {label}
              </button>
            ))}
          </div>
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

/**
 * Filtre « Biens » : un interrupteur par bien pour le compter ou non dans le rapport (enregistré : le
 * choix reste jusqu'à ce qu'on le change), et « Voir seul » pour afficher un seul bien (filtre d'URL).
 */
function BiensFilter({
  biens,
  others,
  selected,
  onSelect,
}: {
  biens: CountedBien[];
  /** Listings non regroupés : toujours comptés, consultables seuls. */
  others: { key: string; name: string }[];
  selected: string;
  onSelect: (bien: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // État affiché tout de suite, avant la réponse du serveur.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const excludedOf = (b: CountedBien) => optimistic[b.id] ?? b.excluded;
  const counted = biens.filter((b) => !excludedOf(b)).length;
  const alone = selected === "tous" ? null : (biens.find((b) => b.id === selected)?.name ?? others.find((o) => o.key === selected)?.name ?? null);

  function toggle(targets: CountedBien[], excluded: boolean) {
    const changed = targets.filter((b) => excludedOf(b) !== excluded);
    if (!changed.length) return;
    setOptimistic((o) => ({ ...o, ...Object.fromEntries(changed.map((b) => [b.id, excluded])) }));
    startTransition(async () => {
      const results = await Promise.all(changed.map((b) => setBienExcluded(b.id, excluded)));
      const failed = results.find((r) => !r.ok);
      if (failed && !failed.ok) toast.error(failed.error);
      setOptimistic({});
    });
  }

  function select(bien: string) {
    setOpen(false);
    onSelect(bien);
  }

  const total = biens.length + others.length;
  const label = alone ?? (counted === biens.length ? `Tous les biens (${total})` : `${counted + others.length} sur ${total}`);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 w-56 items-center gap-2 rounded-lg border bg-transparent px-2.5 text-sm text-ink transition hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            alone ? "border-gold" : "border-input",
          )}
        >
          <Building2 className={cn("size-4 shrink-0", alone ? "text-gold-deep" : "text-muted-foreground")} aria-hidden />
          <span className="flex-1 truncate text-left">{label}</span>
          {pending ? <Loader2 className="size-4 animate-spin text-gold-deep" aria-label="Enregistrement" /> : <ChevronDown className="size-4 text-muted-foreground" aria-hidden />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="border-b border-border/70 px-4 py-3">
          <p className="text-sm font-medium text-ink">Biens du rapport</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            L&apos;interrupteur compte ou retire un bien des totaux, des graphiques et de l&apos;export. « Voir seul » affiche un seul
            bien.
          </p>
        </div>
        {alone && (
          <button
            type="button"
            onClick={() => select("tous")}
            className="flex w-full items-center gap-2 border-b border-border/70 bg-accent/50 px-4 py-2 text-left text-sm font-medium text-gold-deep hover:bg-accent"
          >
            <ArrowLeft className="size-4" aria-hidden /> Revenir à tous les biens
          </button>
        )}
        <ul className="max-h-80 overflow-y-auto py-1">
          {biens.map((b) => {
            const on = !excludedOf(b);
            return (
              <li key={b.id} className={cn("flex items-center gap-2 px-4 py-1.5", selected === b.id && "bg-accent/40")}>
                <span className={cn("min-w-0 flex-1 truncate text-sm", on ? "text-ink" : "text-muted-foreground line-through")}>{b.name}</span>
                <AloneButton active={selected === b.id} onClick={() => select(b.id)} />
                <Switch checked={on} onCheckedChange={(v) => toggle([b], !v)} aria-label={`Compter ${b.name} dans le rapport`} />
              </li>
            );
          })}
          {others.map((o) => (
            <li key={o.key} className={cn("flex items-center gap-2 px-4 py-1.5", selected === o.key && "bg-accent/40")}>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{o.name}</span>
              <AloneButton active={selected === o.key} onClick={() => select(o.key)} />
              {/* Même largeur que l'interrupteur : les boutons restent alignés. */}
              <span className="w-8" aria-hidden />
            </li>
          ))}
        </ul>
        {counted < biens.length && (
          <div className="border-t border-border/70 px-4 py-2">
            <button type="button" onClick={() => toggle(biens, false)} className="text-xs font-medium text-gold-deep hover:underline">
              Tout compter
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function AloneButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      className={cn(
        "shrink-0 rounded-md px-2 py-1 text-xs font-medium transition",
        active ? "bg-ink text-ivory" : "text-gold-deep hover:bg-accent",
      )}
    >
      {active ? "Affiché" : "Voir seul"}
    </button>
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
