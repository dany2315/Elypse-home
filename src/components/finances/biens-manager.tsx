"use client";

import { BookOpen, Combine, Loader2, Unlink, Wand2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { detachListing, mergeBiens, proposeBiens, renameBien, setBienLivret } from "@/app/dashboard/finances/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { channelLabel } from "@/lib/finances/report";

type Listing = { id: number; name: string; publicName: string; channels: string[]; active: boolean; reservations: number };
type Bien = { id: string; name: string; livretId: string | null; listings: Listing[] };

type Props = { biens: Bien[]; livrets: { id: string; name: string }[]; orphanCount: number };

const NO_LIVRET = "__aucun__";

export function BiensManager({ biens, livrets, orphanCount }: Props) {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await action();
      if (res.ok) toast.success(success);
      else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {orphanCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-gold/50 bg-accent/30 px-5 py-4 text-sm">
          <span>
            {orphanCount} listing{orphanCount > 1 ? "s" : ""} sans bien.
          </span>
          <Button size="lg" disabled={pending} onClick={() => run(proposeBiens, "Biens créés")}>
            <Wand2 /> Créer un bien par listing
          </Button>
        </div>
      )}

      {biens.length === 0 && orphanCount === 0 && (
        <div className="rounded-3xl border border-dashed border-gold/40 bg-white/60 px-6 py-16 text-center">
          <p className="font-serif text-2xl text-ink">Aucun listing</p>
          <p className="mt-2 text-sm text-muted-foreground">Lancez « Actualiser depuis Hostaway » sur la page Finances.</p>
        </div>
      )}

      <ul className="flex flex-col gap-4">
        {biens.map((b) => (
          <li key={b.id}>
            <BienCard bien={b} biens={biens} livrets={livrets} pending={pending} run={run} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function BienCard({
  bien,
  biens,
  livrets,
  pending,
  run,
}: {
  bien: Bien;
  biens: Bien[];
  livrets: { id: string; name: string }[];
  pending: boolean;
  run: (action: () => Promise<{ ok: boolean; error?: string }>, success: string) => void;
}) {
  const [name, setName] = useState(bien.name);
  const others = biens.filter((o) => o.id !== bien.id);

  return (
    <article className="rounded-3xl border border-border/80 bg-card p-5 shadow-[0_1px_0_rgba(18,22,42,.04),0_20px_40px_-28px_rgba(18,22,42,.35)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Nom du bien</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() !== bien.name && run(() => renameBien(bien.id, name), "Bien renommé")}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="h-9 font-serif text-lg"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            <BookOpen className="size-3" /> Livret
          </span>
          <Select
            value={bien.livretId ?? NO_LIVRET}
            onValueChange={(v) => run(() => setBienLivret(bien.id, v === NO_LIVRET ? null : v), "Livret relié")}
          >
            <SelectTrigger className="h-9 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_LIVRET}>Aucun livret</SelectItem>
              {livrets.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        {others.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              <Combine className="size-3" /> Fusionner dans
            </span>
            <Select
              value=""
              onValueChange={(target) => {
                const t = others.find((o) => o.id === target);
                if (t && window.confirm(`Rattacher les listings de « ${bien.name} » au bien « ${t.name} » ?`)) {
                  run(() => mergeBiens(bien.id, target), `Fusionné dans « ${t.name} »`);
                }
              }}
            >
              <SelectTrigger className="h-9 w-52">
                <SelectValue placeholder="Choisir un bien…" />
              </SelectTrigger>
              <SelectContent>
                {others.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
        {pending && <Loader2 className="mb-2.5 size-4 animate-spin text-gold-deep" />}
      </div>

      <ul className="mt-4 divide-y divide-border/60 rounded-2xl border border-border/60">
        {bien.listings.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm">
            <span className="font-medium text-ink">{l.name}</span>
            {l.publicName && <span className="truncate text-muted-foreground">{l.publicName}</span>}
            <span className="text-xs text-muted-foreground">#{l.id}</span>
            {l.channels.map((c) => (
              <Badge key={c} variant="outline" className="border-gold/40 text-gold-deep">
                {channelLabel(c)}
              </Badge>
            ))}
            {!l.active && <Badge variant="secondary">Inactif dans Hostaway</Badge>}
            <span className="ml-auto text-xs text-muted-foreground">
              {l.reservations} réservation{l.reservations > 1 ? "s" : ""}
            </span>
            {bien.listings.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => run(() => detachListing(l.id), "Listing séparé dans son propre bien")}
              >
                <Unlink /> Séparer
              </Button>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}
