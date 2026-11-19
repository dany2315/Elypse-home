"use client";

import {
  Building2,
  CircleSlash,
  Ellipsis,
  History,
  House,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  ShieldCheck,
  Sofa,
  Sparkles,
  Trash2,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { addChargeVersion, createCharge, deleteCharge, deleteChargeVersion, renameCharge } from "@/app/dashboard/finances/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CHARGE_CATEGORIES,
  chargeCategoryLabel,
  chargeForMonth,
  chargeSegments,
  htFromTtc,
  nextSegment,
  parseEuros,
  segmentAt,
  ttcOf,
  vatOf,
  VAT_RATES,
  vatRateLabel,
  type ChargeCategory,
  type ChargeSegment,
  type ReportCharge,
} from "@/lib/finances/charges";
import { eur, longDate, monthLabel, shortDate } from "@/lib/finances/filters";
import { cn } from "@/lib/utils";

type BienData = { id: string; name: string; excluded: boolean; charges: ReportCharge[] };
type Result = { ok: boolean; error?: string };
type Run = (action: () => Promise<Result>, success: string, after?: () => void) => void;

type DialogState =
  | { kind: "create"; bien: BienData; category: ChargeCategory }
  | { kind: "version"; bien: BienData; charge: ReportCharge }
  | { kind: "rename"; charge: ReportCharge }
  | null;

const ICONS: Record<ChargeCategory, LucideIcon> = {
  loyer: House,
  leasing: Sofa,
  electricite: Zap,
  internet: Wifi,
  assurance: ShieldCheck,
  copropriete: Building2,
  menage: Sparkles,
  autre: Receipt,
};
function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = ICONS[category as ChargeCategory] ?? Receipt;
  return <Icon className={className} aria-hidden />;
}

/** Charges proposées sur chaque bien tant qu'elles n'y sont pas. */
const SUGGESTED: ChargeCategory[] = ["loyer", "leasing", "electricite"];

/** TVA proposée par défaut selon le type (modifiable). */
const DEFAULT_VAT: Record<ChargeCategory, number> = {
  loyer: 0,
  leasing: 2000,
  electricite: 2000,
  internet: 2000,
  assurance: 0,
  copropriete: 0,
  menage: 2000,
  autre: 2000,
};

const firstOfMonth = (d: string) => `${d.slice(0, 7)}-01`;
const firstOfNextMonth = (d: string) => {
  const [y, m] = d.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
};
/** Centimes → texte du champ (1250,50). */
const amountText = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

const parisDay = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" });
const parisTime = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const savedAt = (iso: string) => `${shortDate(parisDay.format(new Date(iso)))} à ${parisTime.format(new Date(iso))}`;

const segmentPeriod = (s: ChargeSegment, today: string) =>
  s.end ? `Du ${longDate(s.start)} au ${longDate(s.end)}` : s.start > today ? `À partir du ${longDate(s.start)}` : `Depuis le ${longDate(s.start)}`;
const perMonth = (s: { amountCents: number; vatRateBp: number }) =>
  `${eur(ttcOf(s.amountCents, s.vatRateBp))} TTC / mois · ${eur(s.amountCents)} HT · TVA ${vatRateLabel(s.vatRateBp)}`;

export function ChargesManager({ today, biens }: { today: string; biens: BienData[] }) {
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>(null);
  const month = today.slice(0, 7);

  const run: Run = (action, success, after) =>
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        toast.success(success);
        after?.();
      } else toast.error(res.error);
    });

  const summary = useMemo(() => {
    const t = { ht: 0, vat: 0, count: 0, biens: 0 };
    for (const b of biens) {
      if (b.excluded) continue;
      let any = false;
      for (const c of b.charges) {
        const m = chargeForMonth(chargeSegments(c.versions), month);
        t.ht += m.ht;
        t.vat += m.vat;
        if (m.ttc) {
          t.count++;
          any = true;
        }
      }
      if (any) t.biens++;
    }
    return t;
  }, [biens, month]);
  const excludedCount = biens.filter((b) => b.excluded).length;

  if (biens.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-gold/40 bg-white/60 px-6 py-16 text-center">
        <p className="font-serif text-2xl text-ink">Aucun bien</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Créez d&apos;abord vos biens dans{" "}
          <Link href="/dashboard/finances/biens" className="text-gold-deep underline underline-offset-2">
            Biens et listings
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-3xl border border-gold/40 bg-night px-6 py-5 text-ivory sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-gold-light uppercase">Charges de {monthLabel(month)}</p>
          <p className="mt-2 font-serif text-3xl tabular-nums">{eur(summary.ht + summary.vat)}</p>
          <p className="mt-1 text-xs text-ivory/70">
            TTC · dont {eur(summary.ht)} HT et {eur(summary.vat)} de TVA ·{" "}
            {summary.count === 0
              ? "aucune charge ce mois-ci"
              : `${summary.count} charge${summary.count > 1 ? "s" : ""} sur ${summary.biens} bien${summary.biens > 1 ? "s" : ""}`}
            {excludedCount > 0 && ` · biens exclus des calculs non comptés`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pending && <Loader2 className="size-4 animate-spin text-gold-light" aria-label="Enregistrement…" />}
          <Button asChild variant="outline" size="lg" className="border-gold/50 bg-transparent text-ivory hover:bg-ivory/10 hover:text-ivory">
            <Link href="/dashboard/finances">Voir le bénéfice</Link>
          </Button>
        </div>
      </section>

      <ul className="flex flex-col gap-4">
        {biens.map((b) => (
          <li key={b.id}>
            <BienCharges
              bien={b}
              today={today}
              pending={pending}
              run={run}
              onAdd={(category) => setDialog({ kind: "create", bien: b, category })}
              onEdit={(charge) => setDialog({ kind: "version", bien: b, charge })}
              onRename={(charge) => setDialog({ kind: "rename", charge })}
            />
          </li>
        ))}
      </ul>

      {dialog?.kind === "rename" && <RenameDialog charge={dialog.charge} pending={pending} run={run} onClose={() => setDialog(null)} />}
      {(dialog?.kind === "create" || dialog?.kind === "version") && (
        <AmountDialog state={dialog} today={today} pending={pending} run={run} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

/* ---------------------------------- Bien ---------------------------------- */

function BienCharges({
  bien,
  today,
  pending,
  run,
  onAdd,
  onEdit,
  onRename,
}: {
  bien: BienData;
  today: string;
  pending: boolean;
  run: Run;
  onAdd: (category: ChargeCategory) => void;
  onEdit: (charge: ReportCharge) => void;
  onRename: (charge: ReportCharge) => void;
}) {
  const month = today.slice(0, 7);
  const monthTotal = bien.charges.reduce((a, c) => a + chargeForMonth(chargeSegments(c.versions), month).ttc, 0);
  const missing = SUGGESTED.filter((c) => !bien.charges.some((x) => x.category === c));

  return (
    <article className="rounded-3xl border border-border/80 bg-card p-5 shadow-[0_1px_0_rgba(18,22,42,.04),0_20px_40px_-28px_rgba(18,22,42,.35)]">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-serif text-2xl text-ink">{bien.name}</h2>
        {bien.excluded && (
          <Badge variant="secondary" title="Ce bien n'est pas compté dans le rapport global (réglage dans Biens et listings)">
            Exclu des calculs
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-3">
          {monthTotal > 0 && (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-ink tabular-nums">{eur(monthTotal)}</span> TTC en {monthLabel(month, false)}
            </p>
          )}
          <Button variant="outline" size="lg" onClick={() => onAdd(missing[0] ?? "autre")}>
            <Plus /> Ajouter une charge
          </Button>
        </div>
      </header>

      {bien.charges.length > 0 ? (
        <ul className="mt-4 divide-y divide-border/60 rounded-2xl border border-border/60">
          {bien.charges.map((c) => (
            <ChargeRow key={c.id} charge={c} today={today} pending={pending} run={run} onEdit={() => onEdit(c)} onRename={() => onRename(c)} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Aucune charge saisie pour ce bien.</p>
      )}

      {missing.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{bien.charges.length ? "Ajouter aussi :" : "Pour commencer :"}</span>
          {missing.map((c) => {
            return (
              <button
                key={c}
                type="button"
                onClick={() => onAdd(c)}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-gold/50 px-3 py-1 text-xs font-medium text-gold-deep transition hover:border-solid hover:bg-accent focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:outline-none"
              >
                <Plus className="size-3" aria-hidden />
                <CategoryIcon category={c} className="size-3.5" />
                {chargeCategoryLabel(c)}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}

/* --------------------------------- Charge --------------------------------- */

function ChargeRow({
  charge,
  today,
  pending,
  run,
  onEdit,
  onRename,
}: {
  charge: ReportCharge;
  today: string;
  pending: boolean;
  run: Run;
  onEdit: () => void;
  onRename: () => void;
}) {
  const [open, setOpen] = useState(false);
  const segments = useMemo(() => chargeSegments(charge.versions), [charge.versions]);
  const current = segmentAt(segments, today);
  const next = nextSegment(segments, today);
  const last = segments[segments.length - 1];
  const category = chargeCategoryLabel(charge.category);

  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-wrap items-start gap-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", current?.amountCents ? "bg-accent text-gold-deep" : "bg-muted text-muted-foreground")}>
          <CategoryIcon category={charge.category} className="size-4" />
        </span>
        <div className="min-w-0 flex-1 basis-56">
          <p className="font-medium text-ink">
            {charge.label}
            {charge.label !== category && <span className="ml-2 text-xs font-normal text-muted-foreground">{category}</span>}
          </p>
          {current && current.amountCents > 0 ? (
            <>
              <p className="mt-0.5 text-sm tabular-nums">
                <span className="font-semibold text-ink">{eur(ttcOf(current.amountCents, current.vatRateBp))} TTC</span>
                <span className="text-muted-foreground">
                  {" "}
                  / mois · {eur(current.amountCents)} HT · TVA {vatRateLabel(current.vatRateBp)}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                depuis le {longDate(current.start)}
                {current.end && !next && ` · jusqu'au ${longDate(current.end)}`}
              </p>
            </>
          ) : current ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <CircleSlash className="size-3.5" aria-hidden /> Arrêtée depuis le {longDate(current.start)}
              {current.end && ` jusqu'au ${longDate(current.end)}`}
            </p>
          ) : next ? (
            <p className="mt-0.5 text-sm text-muted-foreground">Commence le {longDate(next.start)}</p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">Terminée{last?.end ? ` le ${longDate(last.end)}` : ""}</p>
          )}
          {next && (
            <p className="mt-1 text-xs font-medium text-gold-deep">
              {next.amountCents === 0
                ? `Arrêt prévu le ${longDate(next.start)}`
                : `À partir du ${longDate(next.start)} : ${eur(ttcOf(next.amountCents, next.vatRateBp))} TTC / mois`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" disabled={pending} onClick={onEdit}>
            <Pencil /> Modifier
          </Button>
          <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <History /> Historique
            <span className="text-muted-foreground">({charge.versions.length})</span>
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={`Autres actions pour ${charge.label}`}>
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onRename}>
                <Pencil /> Renommer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  if (window.confirm(`Supprimer « ${charge.label} » et tout son historique ? Elle disparaîtra aussi des mois passés.`)) {
                    run(() => deleteCharge(charge.id), "Charge supprimée");
                  }
                }}
              >
                <Trash2 /> Supprimer la charge
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {open && <HistoryPanel charge={charge} segments={segments} today={today} pending={pending} run={run} />}
    </li>
  );
}

function HistoryPanel({
  charge,
  segments,
  today,
  pending,
  run,
}: {
  charge: ReportCharge;
  segments: ChargeSegment[];
  today: string;
  pending: boolean;
  run: Run;
}) {
  const applied = new Set(segments.map((s) => s.versionId));
  const saisies = [...charge.versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="mt-3 grid gap-5 rounded-2xl bg-sand/40 p-4 text-sm sm:ml-12 md:grid-cols-2">
      <section>
        <h3 className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Montants appliqués</h3>
        <ol className="mt-3 space-y-3 border-l border-gold/40 pl-4">
          {[...segments].reverse().map((s) => {
            const state = s.start > today ? "À venir" : s.end && s.end < today ? "Passé" : "En cours";
            return (
              <li key={`${s.versionId}-${s.start}`} className="relative">
                <span
                  className={cn(
                    "absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2",
                    state === "En cours" ? "border-gold bg-gold" : "border-gold/60 bg-card",
                  )}
                  aria-hidden
                />
                <p className="flex flex-wrap items-center gap-2 text-ink">
                  {segmentPeriod(s, today)}
                  <span
                    className={cn(
                      "rounded-full px-2 py-px text-[10px] font-semibold tracking-wide uppercase",
                      state === "En cours" ? "bg-gold/20 text-gold-deep" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {state}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">{s.amountCents ? perMonth(s) : "Charge arrêtée (0 €)"}</p>
              </li>
            );
          })}
          {segments.length === 0 && <li className="text-muted-foreground">Aucun montant appliqué.</li>}
        </ol>
      </section>

      <section>
        <h3 className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Saisies ({saisies.length})</h3>
        <ul className="mt-3 space-y-2.5">
          {saisies.map((v) => (
            <li key={v.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-ink tabular-nums">
                  {v.amountCents ? `${eur(v.amountCents)} HT · TVA ${vatRateLabel(v.vatRateBp)}` : "Arrêt de la charge"}
                  <span className="text-muted-foreground">
                    {" "}
                    · {v.end ? `du ${shortDate(v.start)} au ${shortDate(v.end)}` : `à partir du ${shortDate(v.start)}`}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Saisie le {savedAt(v.createdAt)}
                  {v.note && ` · ${v.note}`}
                  {!applied.has(v.id) && " · entièrement remplacée par une saisie plus récente"}
                </p>
              </div>
              {charge.versions.length > 1 && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={pending}
                  aria-label="Supprimer cette saisie"
                  title="Supprimer cette saisie (erreur de frappe)"
                  onClick={() => {
                    if (window.confirm("Supprimer cette saisie ? Les montants seront recalculés sans elle.")) {
                      run(() => deleteChargeVersion(v.id), "Saisie supprimée");
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* --------------------------------- Saisie --------------------------------- */

function AmountDialog({
  state,
  today,
  pending,
  run,
  onClose,
}: {
  state: Extract<DialogState, { kind: "create" | "version" }>;
  today: string;
  pending: boolean;
  run: Run;
  onClose: () => void;
}) {
  const isCreate = state.kind === "create";
  const segments = useMemo(() => (state.kind === "version" ? chargeSegments(state.charge.versions) : []), [state]);
  const reference = segmentAt(segments, today) ?? segments[segments.length - 1] ?? null;

  const [category, setCategory] = useState<ChargeCategory>(state.kind === "create" ? state.category : "autre");
  const [label, setLabel] = useState(state.kind === "create" ? chargeCategoryLabel(state.category) : state.charge.label);
  const [labelEdited, setLabelEdited] = useState(false);
  const [stop, setStop] = useState(false);
  const [basis, setBasis] = useState<"ht" | "ttc">("ht");
  const [rate, setRate] = useState(reference?.vatRateBp ?? (state.kind === "create" ? DEFAULT_VAT[state.category] : 2000));
  const [text, setText] = useState(reference?.amountCents ? amountText(reference.amountCents) : "");
  const [start, setStart] = useState(isCreate ? firstOfMonth(today) : firstOfNextMonth(today));
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");

  const entered = parseEuros(text);
  const ht = entered === null ? null : basis === "ht" ? entered : htFromTtc(entered, rate);
  const datesOk = !!start && (!end || end >= start);
  const valid = datesOk && (stop || (ht !== null && ht > 0)) && (!isCreate || label.trim().length > 0);
  // Changements déjà prévus après la date choisie, qu'une saisie sans fin remplacerait.
  const overridden = !end ? segments.filter((s) => s.start >= start) : [];

  function pickCategory(c: ChargeCategory) {
    setCategory(c);
    if (!labelEdited) setLabel(chargeCategoryLabel(c));
    setRate(DEFAULT_VAT[c]);
  }

  function switchBasis(next: "ht" | "ttc") {
    if (next === basis) return;
    if (entered !== null) setText(amountText(next === "ttc" ? ttcOf(entered, rate) : htFromTtc(entered, rate)));
    setBasis(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const version = { amountCents: stop ? 0 : ht!, vatRateBp: rate, start, end: end || null, note };
    if (state.kind === "create") {
      run(() => createCharge({ bienId: state.bien.id, category, label, ...version }), `« ${label.trim()} » ajoutée`, onClose);
    } else {
      run(() => addChargeVersion(state.charge.id, version), stop ? "Arrêt enregistré" : "Nouveau montant enregistré", onClose);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-x-hidden overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="grid min-w-0 grid-cols-1 gap-5">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-normal text-ink">
              {state.kind === "create" ? "Nouvelle charge" : `Modifier « ${state.charge.label} »`}
            </DialogTitle>
            <DialogDescription>
              {state.bien.name}
              {state.kind === "version" && " · le nouveau montant s'applique à partir de la date choisie, les mois précédents ne changent pas."}
            </DialogDescription>
          </DialogHeader>

          {state.kind === "create" ? (
            <>
              <fieldset>
                <legend className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Type</legend>
                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup">
                  {CHARGE_CATEGORIES.map((c) => {
                    const active = c.value === category;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => pickCategory(c.value)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:outline-none",
                          active ? "border-gold bg-accent text-ink" : "border-border text-ink/75 hover:bg-accent/50",
                        )}
                      >
                        <CategoryIcon category={c.value} className={cn("size-3.5 shrink-0", active ? "text-gold-deep" : "text-muted-foreground")} />
                        <span className="truncate">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <Field label="Libellé">
                <Input
                  value={label}
                  maxLength={80}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    setLabelEdited(true);
                  }}
                />
              </Field>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Type de changement">
              {[
                { v: false, l: "Nouveau montant" },
                { v: true, l: "Arrêter la charge" },
              ].map((o) => (
                <button
                  key={o.l}
                  type="button"
                  role="radio"
                  aria-checked={stop === o.v}
                  onClick={() => setStop(o.v)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:outline-none",
                    stop === o.v ? "bg-card text-ink shadow-sm" : "text-muted-foreground hover:text-ink",
                  )}
                >
                  {o.l}
                </button>
              ))}
            </div>
          )}

          {!stop && (
            <div className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
                <Field label="Montant par mois">
                  <div className="flex">
                    <Input
                      inputMode="decimal"
                      placeholder="0,00"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      aria-invalid={text !== "" && entered === null}
                      className="rounded-r-none tabular-nums"
                      autoFocus
                    />
                    <div className="flex rounded-r-md border border-l-0 border-input p-0.5" role="radiogroup" aria-label="Montant saisi">
                      {(["ht", "ttc"] as const).map((b) => (
                        <button
                          key={b}
                          type="button"
                          role="radio"
                          aria-checked={basis === b}
                          onClick={() => switchBasis(b)}
                          className={cn(
                            "rounded px-2 text-xs font-semibold uppercase transition",
                            basis === b ? "bg-night text-ivory" : "text-muted-foreground hover:text-ink",
                          )}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                </Field>
                <Field label="TVA">
                  <Select value={String(rate)} onValueChange={(v) => setRate(Number(v))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VAT_RATES.map((r) => (
                        <SelectItem key={r.value} value={String(r.value)}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <p className="rounded-xl bg-sand/50 px-3 py-2 text-xs text-ink/80 tabular-nums">
                {ht === null ? (
                  text ? (
                    <span className="text-destructive">Montant invalide (ex. : 1 250,50)</span>
                  ) : (
                    "Saisissez le montant mensuel, hors taxes ou TVA comprise."
                  )
                ) : (
                  <>
                    {eur(ht)} HT + {eur(vatOf(ht, rate))} de TVA = <span className="font-semibold text-ink">{eur(ttcOf(ht, rate))} TTC</span>{" "}
                    par mois
                  </>
                )}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={stop ? "Arrêter à partir du" : "À partir du"}>
              <Input type="date" className={DATE_INPUT} value={start} required onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Jusqu'au (facultatif)">
              <Input type="date" className={DATE_INPUT} value={end} min={start} onChange={(e) => setEnd(e.target.value)} aria-invalid={!!end && end < start} />
            </Field>
          </div>

          {start && (
            <ul className="-mt-2 space-y-1 text-xs text-muted-foreground">
              {state.kind === "version" && (
                <li>
                  Avant le {longDate(start)}, rien ne change
                  {reference ? ` (${reference.amountCents ? `${eur(ttcOf(reference.amountCents, reference.vatRateBp))} TTC / mois` : "charge arrêtée"})` : ""}.
                </li>
              )}
              {end ? (
                end >= start ? (
                  <li>{state.kind === "version" ? `Après le ${longDate(end)}, le montant d'avant reprend.` : `La charge s'arrête après le ${longDate(end)}.`}</li>
                ) : (
                  <li className="text-destructive">La date de fin doit être après la date de début.</li>
                )
              ) : (
                <li>Sans date de fin : {stop ? "la charge reste arrêtée." : "ce montant s'applique jusqu'au prochain changement."}</li>
              )}
              {overridden.length > 0 && (
                <li className="text-gold-deep">
                  Remplace aussi le changement déjà prévu le {longDate(overridden[0].start)} (ajoutez une date de fin pour le garder).
                </li>
              )}
            </ul>
          )}

          <Field label="Note (facultatif)">
            <Input value={note} maxLength={300} placeholder="Ex. : nouveau bail, contrat EDF…" onChange={(e) => setNote(e.target.value)} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" size="lg" disabled={!valid || pending}>
              {pending && <Loader2 className="animate-spin" />}
              {state.kind === "create" ? "Ajouter la charge" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ charge, pending, run, onClose }: { charge: ReportCharge; pending: boolean; run: Run; onClose: () => void }) {
  const [name, setName] = useState(charge.label);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) run(() => renameCharge(charge.id, name), "Charge renommée", onClose);
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-normal text-ink">Renommer</DialogTitle>
            <DialogDescription>Le nom change partout, montants et historique compris.</DialogDescription>
          </DialogHeader>
          <Input value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} />
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" size="lg" disabled={!name.trim() || pending}>
              Renommer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Champ date : sur iPhone (Safari), un champ date garde sa largeur native et fait déborder le dialog
 * (défilement horizontal). On retire l'apparence native et on aligne la date à gauche.
 */
const DATE_INPUT = "block appearance-none text-left [&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:min-h-[1.25em]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">{label}</span>
      {children}
    </label>
  );
}
