"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadImage } from "@/app/dashboard/actions";
import { compressImage } from "@/lib/compress-image";
import { imageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";

async function upload(file: File): Promise<string | null> {
  const compressed = await compressImage(file).catch(() => file);
  const fd = new FormData();
  fd.set("file", compressed);
  try {
    const bmp = await createImageBitmap(compressed);
    fd.set("width", String(bmp.width));
    fd.set("height", String(bmp.height));
    bmp.close();
  } catch {}
  const res = await uploadImage(fd);
  if (!res.ok) {
    toast.error(res.error);
    return null;
  }
  return res.data!;
}

function Thumb({ id, onRemove, className }: { id: string; onRemove: () => void; className?: string }) {
  return (
    <div className={cn("group relative overflow-hidden rounded-2xl border bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl(id)!} alt="" className="size-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-night/70 text-ivory backdrop-blur transition hover:bg-destructive"
        aria-label="Retirer la photo"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function DropZone({
  onFiles,
  busy,
  multiple,
  className,
  label = "Ajouter une photo",
}: {
  onFiles: (files: File[]) => void;
  busy: boolean;
  multiple?: boolean;
  className?: string;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => input.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gold/50 bg-accent/40 text-sm text-ink/70 transition hover:border-gold hover:bg-accent",
        className,
      )}
    >
      {busy ? <Loader2 className="size-5 animate-spin text-gold-deep" /> : <ImagePlus className="size-5 text-gold-deep" />}
      <span className="font-medium">{busy ? "Envoi…" : label}</span>
      <span className="text-[11px] text-muted-foreground">JPG, PNG, HEIC — compressée automatiquement</span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </button>
  );
}

export function ImageUpload({
  value,
  onChange,
  aspect = "aspect-[16/9]",
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  aspect?: string;
}) {
  const [busy, setBusy] = useState(false);
  async function handle(files: File[]) {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    const id = await upload(file);
    setBusy(false);
    if (id) onChange(id);
  }
  return value ? (
    <Thumb id={value} onRemove={() => onChange(null)} className={cn("w-full", aspect)} />
  ) : (
    <DropZone onFiles={handle} busy={busy} className={cn("w-full", aspect)} />
  );
}

export function MultiImageUpload({
  value,
  onChange,
  max = 6,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}) {
  const [busy, setBusy] = useState(false);
  async function handle(files: File[]) {
    setBusy(true);
    const ids: string[] = [];
    for (const f of files.slice(0, max - value.length)) {
      const id = await upload(f);
      if (id) ids.push(id);
    }
    setBusy(false);
    onChange([...value, ...ids]);
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {value.map((id) => (
        <Thumb key={id} id={id} onRemove={() => onChange(value.filter((v) => v !== id))} className="aspect-[4/3]" />
      ))}
      {value.length < max && (
        <DropZone onFiles={handle} busy={busy} multiple className="aspect-[4/3] px-2" label="Ajouter" />
      )}
    </div>
  );
}
