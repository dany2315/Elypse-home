"use client";

import { Check, Copy, Download, ExternalLink, Link2, Loader2, Printer, RefreshCw } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { regenerateLivretToken } from "@/app/dashboard/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { downloadBlob, printBlob, renderPrintCard } from "@/lib/print-card";
import { cn } from "@/lib/utils";

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function useCopy() {
  const [copied, setCopied] = useState(false);
  async function copy(text: string, message = "Lien copié") {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(message);
    setTimeout(() => setCopied(false), 1600);
  }
  return { copied, copy };
}

/** Panneau « Lien du livret » : copier, ouvrir, QR code, régénérer. */
export function LivretLinkPanel({
  livretId,
  url,
  name,
  title,
  onRegenerated,
}: {
  livretId: string;
  url: string;
  name: string;
  /** Titre affiché aux voyageurs (utilisé sur la carte à imprimer). */
  title?: string;
  onRegenerated?: (url: string) => void;
}) {
  const { copied, copy } = useCopy();
  const [qr, setQr] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: "#070c1c", light: "#ffffff" } }).then(setQr);
  }, [url]);

  const [printing, setPrinting] = useState<"download" | "print" | null>(null);
  async function card(mode: "download" | "print") {
    setPrinting(mode);
    try {
      const blob = await renderPrintCard({ url, title: title || name });
      if (mode === "download") {
        downloadBlob(blob, `livret-${slug(name)}-a-imprimer.png`);
        toast.success("Carte téléchargée");
      } else if (!printBlob(blob, title || name)) {
        toast.error("Fenêtre bloquée par le navigateur : autorisez les pop-ups ou utilisez « Télécharger ».");
      }
    } catch {
      toast.error("Impossible de générer la carte.");
    } finally {
      setPrinting(null);
    }
  }

  function regenerate() {
    startTransition(async () => {
      const res = await regenerateLivretToken(livretId);
      if (!res.ok) return void toast.error(res.error);
      const next = url.replace(/\/l\/[^/?#]+/, `/l/${res.data}`);
      onRegenerated?.(next);
      setConfirmOpen(false);
      toast.success("Nouveau lien généré", { description: "L'ancien lien ne fonctionne plus." });
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/50 p-3">
        <p className="mb-1 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Lien voyageur
        </p>
        <p className="font-mono text-xs leading-relaxed break-all text-ink">{url}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => copy(url)} className="col-span-2">
          {copied ? <Check /> : <Copy />} {copied ? "Copié" : "Copier le lien"}
        </Button>
        <Button variant="outline" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink /> Ouvrir
          </a>
        </Button>
        <Button variant="outline" onClick={() => setConfirmOpen(true)}>
          <RefreshCw /> Régénérer
        </Button>
      </div>

      {qr && (
        <div className="space-y-3 rounded-xl border p-3">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code du livret" className="size-16 rounded-md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Carte à imprimer</p>
              <p className="text-xs text-muted-foreground">
                Format A6 avec logo, titre et QR code, à poser dans l&apos;appartement.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" disabled={!!printing} onClick={() => card("download")}>
              {printing === "download" ? <Loader2 className="animate-spin" /> : <Download />} Télécharger
            </Button>
            <Button variant="outline" size="sm" disabled={!!printing} onClick={() => card("print")}>
              {printing === "print" ? <Loader2 className="animate-spin" /> : <Printer />} Imprimer
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Régénérer le lien ?</AlertDialogTitle>
            <AlertDialogDescription>
              Un nouveau lien sera créé pour « {name} ». L&apos;ancien lien cessera immédiatement de fonctionner
              (pensez à mettre à jour vos messages automatiques et QR codes imprimés).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                regenerate();
              }}
              disabled={pending}
            >
              {pending && <Loader2 className="animate-spin" />} Régénérer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function LivretLinkButton({
  livretId,
  url,
  name,
  title,
  className,
  onRegenerated,
}: {
  livretId: string;
  url: string;
  name: string;
  title?: string;
  className?: string;
  onRegenerated?: (url: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn(className)}>
          <Link2 /> Lien
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,22rem)]">
        <LivretLinkPanel livretId={livretId} url={url} name={name} title={title} onRegenerated={onRegenerated} />
      </PopoverContent>
    </Popover>
  );
}
