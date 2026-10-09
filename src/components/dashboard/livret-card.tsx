"use client";

import {
  Bus,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Phone,
  Power,
  Sofa,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { setLivretActive } from "@/app/dashboard/actions";
import { Monogram } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { imageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";
import { LivretLinkButton } from "./livret-link";

export type LivretCardData = {
  id: string;
  name: string;
  title: string;
  address: string;
  active: boolean;
  coverImageId: string | null;
  url: string;
  hasWifi: boolean;
  hasRules: boolean;
  counts: { recos: number; equipements: number; transport: number; contacts: number };
};

const sections = [
  { tab: "recommandations", label: "Recos", icon: Sparkles, key: "recos" },
  { tab: "equipements", label: "Équip.", icon: Sofa, key: "equipements" },
  { tab: "transport", label: "Transport", icon: Bus, key: "transport" },
  { tab: "contacts", label: "Contacts", icon: Phone, key: "contacts" },
] as const;

export function LivretCard({ livret }: { livret: LivretCardData }) {
  const [pending, startTransition] = useTransition();
  const cover = imageUrl(livret.coverImageId);
  const editHref = `/dashboard/livrets/${livret.id}`;

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await action();
      if (res.ok) toast.success(success);
      else toast.error(res.error);
    });
  }

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-[0_1px_0_rgba(18,22,42,.04),0_20px_40px_-28px_rgba(18,22,42,.35)] transition duration-500 hover:-translate-y-0.5 hover:shadow-[0_1px_0_rgba(18,22,42,.04),0_30px_60px_-30px_rgba(18,22,42,.45)]",
        !livret.active && "opacity-80",
      )}
    >
      {/* Visuel */}
      <Link href={editHref} className="relative block aspect-[16/9] overflow-hidden bg-night">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="size-full object-cover transition duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grain flex size-full items-center justify-center bg-[radial-gradient(circle_at_50%_0%,#18204a,#070c1c_70%)]">
            <Monogram className="w-14 opacity-80" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-night/85 via-night/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-[10px] font-semibold tracking-[0.3em] text-gold-light uppercase">{livret.name}</p>
          <h2 className="mt-1 line-clamp-2 font-serif text-[1.45rem] leading-tight text-ivory">{livret.title}</h2>
        </div>
        <span
          className={cn(
            "absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em] uppercase backdrop-blur-md",
            livret.active ? "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-300/30" : "bg-white/10 text-ivory/70 ring-1 ring-white/20",
          )}
        >
          <span className={cn("size-1.5 rounded-full", livret.active ? "bg-emerald-400" : "bg-ivory/50")} />
          {livret.active ? "Actif" : "Inactif"}
        </span>
      </Link>

      {/* Menu secondaire */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-night/40 text-ivory backdrop-blur-md transition hover:bg-night/70"
          aria-label="Plus d'actions"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onClick={() =>
              run(() => setLivretActive(livret.id, !livret.active), livret.active ? "Livret désactivé" : "Livret activé")
            }
          >
            <Power /> {livret.active ? "Désactiver" : "Activer"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Contenu */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {livret.address && <span className="truncate">{livret.address}</span>}
          <span className={livret.hasWifi ? "text-emerald-700" : "text-muted-foreground/60"}>
            {livret.hasWifi ? "✓" : "○"} Wifi
          </span>
          <span className={livret.hasRules ? "text-emerald-700" : "text-muted-foreground/60"}>
            {livret.hasRules ? "✓" : "○"} Règles
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button asChild className="col-span-1">
            <Link href={editHref}>
              <Pencil /> Modifier
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`${editHref}/apercu`}>
              <Eye /> Aperçu
            </Link>
          </Button>
          <LivretLinkButton livretId={livret.id} url={livret.url} name={livret.name} />
        </div>

        <div className="mt-auto grid grid-cols-4 gap-1.5 border-t pt-4">
          {sections.map(({ tab, label, icon: Icon, key }) => (
            <Link
              key={tab}
              href={`${editHref}?tab=${tab}`}
              className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center transition hover:bg-accent"
            >
              <span className="relative">
                <Icon className="size-[18px] text-gold-deep" strokeWidth={1.6} />
                {livret.counts[key] > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-ink px-1 text-center text-[9px] leading-4 font-semibold text-ivory">
                    {livret.counts[key]}
                  </span>
                )}
              </span>
              <span className="text-[11px] font-medium text-ink/80">{label}</span>
            </Link>
          ))}
        </div>
      </div>

    </article>
  );
}
