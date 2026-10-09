"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Localized } from "@/lib/localized";
import { cn } from "@/lib/utils";

export function Section({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-3xl border bg-card p-5 shadow-[0_20px_40px_-34px_rgba(18,22,42,.4)] sm:p-7", className)}>
      <header className="mb-6">
        <h2 className="font-serif text-2xl leading-tight text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-[13px] font-semibold text-ink/90">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TextField({
  label,
  hint,
  value,
  onChange,
  className,
  ...props
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
} & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  return (
    <Field label={label} hint={hint} className={className}>
      <Input value={value} onChange={(e) => onChange(e.target.value)} {...props} />
    </Field>
  );
}

const flags = { fr: "🇫🇷 Français", en: "🇬🇧 English" } as const;

/** Champ bilingue FR / EN côte à côte (empilés sur mobile). */
export function BiField({
  label,
  hint,
  value,
  onChange,
  multiline,
  rows = 4,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: Localized;
  onChange: (v: Localized) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: { fr?: string; en?: string };
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="grid gap-3 md:grid-cols-2">
        {(["fr", "en"] as const).map((lang) => (
          <div key={lang} className="space-y-1.5">
            <span className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
              {flags[lang]}
            </span>
            {multiline ? (
              <Textarea
                rows={rows}
                value={value[lang] ?? ""}
                placeholder={placeholder?.[lang]}
                onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
                className="min-h-24 leading-relaxed"
              />
            ) : (
              <Input
                value={value[lang] ?? ""}
                placeholder={placeholder?.[lang]}
                onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
              />
            )}
          </div>
        ))}
      </div>
    </Field>
  );
}
