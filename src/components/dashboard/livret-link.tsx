"use client";

import { Check, Copy, Download, ExternalLink, Link2, Loader2, RefreshCw } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
  onRegenerated,
}: {
  livretId: string;
  url: string;
  name: string;
  onRegenerated?: (url: string) => void;
}) {
  const { copied, copy } = useCopy();
  const [qr, setQr] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: "#070c1c", light: "#ffffff" } }).then(setQr);
  }, [url]);

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
        <div className="flex items-center gap-4 rounded-xl border p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code du livret" className="size-20 rounded-md" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">QR code</p>
            <p className="text-xs text-muted-foreground">À imprimer et poser dans l&apos;appartement.</p>
            <a
              href={qr}
              download={`livret-${name.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-qr.png`}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-gold-deep hover:underline"
            >
              <Download className="size-3" /> Télécharger
            </a>
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
  className,
  onRegenerated,
}: {
  livretId: string;
  url: string;
  name: string;
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
        <LivretLinkPanel livretId={livretId} url={url} name={name} onRegenerated={onRegenerated} />
      </PopoverContent>
    </Popover>
  );
}
