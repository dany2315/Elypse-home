"use client";

import {
  AlertTriangle,
  Car,
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  Globe,
  KeyRound,
  Lightbulb,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import {
  ACCESS_TYPES,
  CONTACT_TYPES,
  EMERGENCY_NUMBERS,
  EQUIPMENT_CATEGORIES,
  findOption,
  RECO_CATEGORIES,
  TRANSPORT_TYPES,
  TRAVEL_MODES,
} from "@/lib/catalog";
import { imageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";
import { useLivret } from "./context";
import { Card, CodeDisplay, CopyButton, Eyebrow, mapsUrl, NavButtons, Prose, telUrl, WazeIcon, wazeUrl } from "./ui";
import { useWeather, weatherIcon, weatherLabel } from "./use-weather";

const fullAddress = (address: string, city: string) => [address, city].filter(Boolean).join(", ");

/* --------------------------------- Arrivée -------------------------------- */

function Step({
  n,
  title,
  last,
  children,
}: {
  n: React.ReactNode;
  title: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/50 bg-white font-serif text-lg text-gold-deep shadow-sm">
          {n}
        </span>
        {!last && <span className="mt-2 w-px flex-1 bg-gradient-to-b from-gold/50 to-gold/5" />}
      </div>
      <div className={cn("min-w-0 flex-1", !last && "pb-8")}>
        <h3 className="pt-1 font-serif text-[1.35rem] leading-tight text-ink">{title}</h3>
        <div className="mt-3 space-y-3">{children}</div>
      </div>
    </li>
  );
}

export function ArrivalPage() {
  const { data, tr, loc, lang, openImage } = useLivret();
  const l = data.livret;
  const address = fullAddress(l.address, l.city);
  const parking = loc(l.parking);
  const access = ACCESS_TYPES.find((a) => a.value === l.accessType);
  const steps: { title: string; body: React.ReactNode }[] = [];

  steps.push({
    title: tr("stepAddress"),
    body: (
      <>
        {address && <p className="text-[15px] text-ink/80">{address}</p>}
        {l.buildingCode && (
          <div className="space-y-2">
            <Eyebrow>{tr("doorCode")}</Eyebrow>
            <CodeDisplay value={l.buildingCode} />
            <CopyButton value={l.buildingCode} label={tr("copy")} copiedLabel={tr("copied")} className="w-full" />
          </div>
        )}
        <Prose text={loc(l.buildingInstructions)} />
        {address && <NavButtons query={address} />}
      </>
    ),
  });

  if (parking) steps.push({ title: tr("stepParking"), body: <Prose text={parking} /> });

  if (l.keyboxCode || loc(l.keyInstructions) || access?.value) {
    steps.push({
      title: tr("stepKeys"),
      body: (
        <>
          {access?.value && (
            <p className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-ink/80">
              <KeyRound className="size-3.5 text-gold-deep" /> {lang === "en" ? access.en : access.fr}
            </p>
          )}
          {l.keyboxCode && (
            <div className="space-y-2">
              <Eyebrow>{tr("keyboxCode")}</Eyebrow>
              <CodeDisplay value={l.keyboxCode} />
              <CopyButton value={l.keyboxCode} label={tr("copy")} copiedLabel={tr("copied")} className="w-full" />
            </div>
          )}
          <Prose text={loc(l.keyInstructions)} />
        </>
      ),
    });
  }

  steps.push({ title: tr("stepWelcome"), body: <Prose text={loc(l.welcomeMessage) || tr("welcomeDefault")} /> });

  return (
    <div className="space-y-6">
      <TimeBanner icon={<Clock className="size-5" />} label={tr("checkinTime")} value={l.checkinTime} />

      <ol className="pt-2">
        {steps.map((s, i) => (
          <Step key={i} n={i === steps.length - 1 ? <Check className="size-4" /> : i + 1} title={s.title} last={i === steps.length - 1}>
            {s.body}
          </Step>
        ))}
      </ol>

      {(l.facadeImageIds.length > 0 || l.videoUrl) && (
        <div className="space-y-3">
          <Eyebrow>{tr("facade")}</Eyebrow>
          {l.facadeImageIds.length > 0 && (
            <div className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5">
              {l.facadeImageIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => openImage(imageUrl(id)!)}
                  className="aspect-[4/5] w-[78%] shrink-0 snap-center overflow-hidden rounded-[1.4rem] bg-sand"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl(id)!} alt="" loading="lazy" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {l.videoUrl && (
            <a
              href={l.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-night text-sm font-semibold text-ivory"
            >
              <PlayCircle className="size-5 text-gold-light" /> {tr("video")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function TimeBanner({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 rounded-[1.6rem] bg-night p-5 text-ivory">
      <span className="flex size-12 items-center justify-center rounded-full border border-gold/40 text-gold-light">{icon}</span>
      <div>
        <p className="text-[11px] tracking-[0.2em] text-ivory/60 uppercase">{label}</p>
        <p className="font-serif text-3xl leading-tight text-gold-light">{value}</p>
      </div>
    </div>
  );
}

/* ---------------------------------- Wifi ---------------------------------- */

const escapeWifi = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");

export function WifiPage() {
  const { data, tr } = useLivret();
  const { wifiSsid, wifiPassword } = data.livret;
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (!wifiSsid) return;
    const payload = `WIFI:T:${wifiPassword ? "WPA" : "nopass"};S:${escapeWifi(wifiSsid)};P:${escapeWifi(wifiPassword)};;`;
    QRCode.toDataURL(payload, { margin: 1, width: 520, color: { dark: "#070c1c", light: "#ffffff" } }).then(setQr);
  }, [wifiSsid, wifiPassword]);

  return (
    <div className="space-y-5">
      <Card className="space-y-5 p-6 text-center">
        <div>
          <Eyebrow>{tr("network")}</Eyebrow>
          <p className="mt-2 font-mono text-xl font-semibold break-all text-ink">{wifiSsid}</p>
        </div>
        <div className="gold-hairline mx-auto h-px w-20" />
        {wifiPassword && (
          <div className="space-y-3">
            <Eyebrow>{tr("password")}</Eyebrow>
            <CodeDisplay value={wifiPassword} className="text-[1.4rem] tracking-[0.08em]" />
            <CopyButton value={wifiPassword} label={tr("copyPassword")} copiedLabel={tr("copied")} variant="gold" className="w-full" />
          </div>
        )}
      </Card>
      {qr && (
        <Card className="flex items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code wifi" className="size-28 shrink-0 rounded-xl border border-[#ebe3d3] p-1" />
          <p className="text-sm leading-relaxed text-ink/70">{tr("scanQr")}</p>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------- Équipements ------------------------------ */

export function EquipmentPage() {
  const { data, tr, loc, lang, openImage } = useLivret();
  const [open, setOpen] = useState<string | null>(null);
  const essentials = loc(data.livret.essentials)
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const groups = EQUIPMENT_CATEGORIES.map((c) => ({
    cat: c,
    items: data.equipments.filter((e) => findOption(EQUIPMENT_CATEGORIES, e.category).value === c.value),
  })).filter((g) => g.items.length);

  return (
    <div className="space-y-7">
      {essentials.length > 0 && (
        <Card className="bg-[linear-gradient(160deg,#fffdf8,#f6eedd)]">
          <Eyebrow className="mb-3">{tr("provided")}</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {essentials.map((e) => (
              <span key={e} className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-white px-3 py-1.5 text-[13px] text-ink/85">
                <Check className="size-3.5 text-gold-deep" /> {e}
              </span>
            ))}
          </div>
        </Card>
      )}

      {groups.map(({ cat, items }) => (
        <section key={cat.value} className="space-y-3">
          <h3 className="flex items-center gap-2 font-serif text-2xl text-ink">
            <span className="text-xl">{cat.icon}</span> {lang === "en" ? cat.en : cat.fr}
          </h3>
          <div className="overflow-hidden rounded-[1.6rem] border border-[#ebe3d3] bg-white">
            {items.map((e, i) => {
              const isOpen = open === e.id;
              const tip = loc(e.tip);
              return (
                <div key={e.id} className={cn(i > 0 && "border-t border-[#f0e9db]")}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : e.id)}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-lg">
                      {e.icon || cat.icon}
                    </span>
                    <span className="flex-1 text-[15px] font-semibold text-ink">{loc(e.name)}</span>
                    <ChevronDown className={cn("size-4 text-stone transition-transform duration-300", isOpen && "rotate-180")} />
                  </button>
                  <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                    <div className="overflow-hidden">
                      <div className="space-y-3 px-4 pb-5">
                        {e.imageId && (
                          <button type="button" onClick={() => openImage(imageUrl(e.imageId)!)} className="block w-full overflow-hidden rounded-xl">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={imageUrl(e.imageId)!} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
                          </button>
                        )}
                        <Prose text={loc(e.instructions)} />
                        {tip && (
                          <div
                            className={cn(
                              "flex gap-2.5 rounded-xl px-3.5 py-3 text-sm leading-relaxed",
                              e.tipType === "warning" ? "bg-amber-50 text-amber-900" : "bg-[#f6f0e2] text-ink/80",
                            )}
                          >
                            {e.tipType === "warning" ? (
                              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                            ) : (
                              <Lightbulb className="mt-0.5 size-4 shrink-0 text-gold-deep" />
                            )}
                            <span>{tip}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------ Adresse & parking ----------------------------- */

export function AccessPage() {
  const { data, tr, loc } = useLivret();
  const l = data.livret;
  const address = fullAddress(l.address, l.city);
  const parking = loc(l.parking);
  return (
    <div className="space-y-5">
      {address && (
        <Card className="overflow-hidden p-0">
          <iframe
            title="Carte"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=16&output=embed`}
            className="h-56 w-full border-0 grayscale-[35%]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-gold-deep" />
              <div>
                <Eyebrow>{tr("fullAddress")}</Eyebrow>
                <p className="mt-1 text-[17px] font-medium text-ink">{l.address}</p>
                <p className="text-sm text-stone">{l.city}</p>
              </div>
            </div>
            <NavButtons query={address} />
            <CopyButton value={address} label={tr("copy")} copiedLabel={tr("copied")} className="w-full" />
          </div>
        </Card>
      )}
      {parking && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Car className="size-5 text-gold-deep" />
            <h3 className="font-serif text-2xl text-ink">{tr("parking")}</h3>
          </div>
          <Prose text={parking} />
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------- Règles --------------------------------- */

const startsWithEmoji = (s: string) => /^\p{Extended_Pictographic}/u.test(s);

export function RulesPage() {
  const { data, loc } = useLivret();
  const lines = loc(data.livret.rules)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const blocks: { title?: string; items: string[]; warning?: string }[] = [];
  for (const line of lines) {
    if (/^⚠️/.test(line)) blocks.push({ items: [], warning: line.replace(/^⚠️\s*/, "") });
    else if (startsWithEmoji(line)) blocks.push({ title: line, items: [] });
    else {
      if (!blocks.length || blocks[blocks.length - 1].warning) blocks.push({ items: [] });
      blocks[blocks.length - 1].items.push(line.replace(/^[-–•]\s*/, ""));
    }
  }

  return (
    <div className="space-y-4">
      {blocks.map((b, i) =>
        b.warning ? (
          <div key={i} className="flex gap-3 rounded-[1.4rem] border border-amber-200 bg-amber-50 p-4 text-[15px] leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
            {b.warning}
          </div>
        ) : (
          <Card key={i}>
            {b.title && (
              <h3 className="mb-3 flex items-center gap-2 font-serif text-[1.45rem] text-ink">
                <span className="text-xl">{b.title.match(/^\p{Extended_Pictographic}️?/u)?.[0]}</span>
                {b.title.replace(/^\p{Extended_Pictographic}️?\s*/u, "")}
              </h3>
            )}
            <ul className="space-y-2.5">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-3 text-[15px] leading-snug text-ink/80">
                  <span className="mt-[0.55rem] size-1.5 shrink-0 rotate-45 bg-gold" />
                  {it}
                </li>
              ))}
            </ul>
          </Card>
        ),
      )}
    </div>
  );
}

/* ---------------------------------- Recos ---------------------------------- */

export function RecosPage() {
  const { data, tr, loc, lang, openImage } = useLivret();
  const [filter, setFilter] = useState<string>("all");
  const present = useMemo(
    () => RECO_CATEGORIES.filter((c) => data.recommendations.some((r) => findOption(RECO_CATEGORIES, r.category).value === c.value)),
    [data.recommendations],
  );
  const visible = data.recommendations.filter(
    (r) => filter === "all" || findOption(RECO_CATEGORIES, r.category).value === filter,
  );

  return (
    <div className="space-y-5">
      {present.length > 1 && (
        <div className="scrollbar-none sticky top-[4.6rem] z-10 -mx-5 flex gap-2 overflow-x-auto bg-ivory/90 px-5 py-2 backdrop-blur">
          {[{ value: "all", icon: "✦", fr: tr("all"), en: tr("all") }, ...present].map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setFilter(c.value)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-4 text-[13px] font-semibold transition",
                filter === c.value ? "border-night bg-night text-ivory" : "border-[#e3d9c6] bg-white text-ink/75",
              )}
            >
              <span className="mr-1">{c.icon}</span> {lang === "en" ? c.en : c.fr}
            </button>
          ))}
        </div>
      )}

      {visible.map((r) => {
        const cat = findOption(RECO_CATEGORIES, r.category);
        const mode = findOption(TRAVEL_MODES, r.travelMode);
        const q = r.address || `${r.name} ${data.livret.city}`;
        return (
          <article key={r.id} className="overflow-hidden rounded-[1.6rem] border border-[#ebe3d3] bg-white shadow-[0_18px_40px_-32px_rgba(18,22,42,.4)]">
            {r.imageId && (
              <button type="button" onClick={() => openImage(imageUrl(r.imageId)!)} className="block w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl(r.imageId)!} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
              </button>
            )}
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <Eyebrow>
                  {cat.icon} {lang === "en" ? cat.en.replace(/s$/, "") : cat.fr.replace(/s$/, "")}
                </Eyebrow>
                {r.travelTime && (
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-ink/75">
                    {mode.icon || "📍"} {r.travelTime}
                  </span>
                )}
              </div>
              <h3 className="mt-2 font-serif text-[1.6rem] leading-tight text-ink">{r.name}</h3>
              <Prose text={loc(r.description)} className="mt-2 text-[14.5px] text-ink/70" />
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionChip href={mapsUrl(q)} icon={<MapPin className="size-3.5" />} dark>
                  {tr("directions")}
                </ActionChip>
                <ActionChip href={wazeUrl(q)} icon={<WazeIcon className="size-3.5 text-[#33ccff]" />}>
                  Waze
                </ActionChip>
                {r.phone && (
                  <ActionChip href={telUrl(r.phone)} icon={<Phone className="size-3.5" />}>
                    {r.category === "restaurant" || r.category === "bar" ? tr("book") : tr("call")}
                  </ActionChip>
                )}
                {r.website && (
                  <ActionChip href={r.website} icon={<Globe className="size-3.5" />}>
                    {tr("website")}
                  </ActionChip>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ActionChip({
  href,
  icon,
  dark,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  dark?: boolean;
  children: React.ReactNode;
}) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold transition active:scale-[0.97]",
        dark ? "bg-night text-ivory" : "border border-[#e3d9c6] bg-white text-ink",
      )}
    >
      {icon}
      {children}
    </a>
  );
}

/* -------------------------------- Transport -------------------------------- */

function LineBadges({ line, color }: { line: string; color: string }) {
  const parts = line.split(/\s*[·,]\s*/).filter(Boolean);
  const bg = /^#[0-9a-f]{6}$/i.test(color) ? color : "#0d1430";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  const light = 0.299 * r + 0.587 * g + 0.114 * b > 165;
  return (
    <div className="flex flex-wrap gap-1.5">
      {parts.map((p) => (
        <span
          key={p}
          className={cn(
            "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold",
            light ? "text-night" : "text-white",
          )}
          style={{ background: bg }}
        >
          {p}
        </span>
      ))}
    </div>
  );
}

export function TransportPage() {
  const { data, tr, loc, lang } = useLivret();
  const links = data.transports.filter((t) => t.type === "plan" || (!t.line && !t.address && (t.url || /^https?:/.test(loc(t.detail)))));
  const stations = data.transports.filter((t) => !links.includes(t));

  return (
    <div className="space-y-4">
      {stations.map((s) => {
        const type = findOption(TRANSPORT_TYPES, s.type);
        return (
          <Card key={s.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Eyebrow>
                  {type.icon} {lang === "en" ? type.en : type.fr}
                </Eyebrow>
                <h3 className="mt-1 font-serif text-[1.55rem] leading-tight text-ink">{s.name}</h3>
              </div>
            </div>
            {s.line && <LineBadges line={s.line} color={s.color} />}
            <Prose text={loc(s.detail)} className="text-[14.5px] text-ink/70" />
            <div className="flex flex-wrap gap-2 pt-1">
              {s.address && (
                <>
                  <ActionChip href={mapsUrl(s.address)} icon={<MapPin className="size-3.5" />} dark>
                    {tr("directions")}
                  </ActionChip>
                  <ActionChip href={wazeUrl(s.address)} icon={<WazeIcon className="size-3.5 text-[#33ccff]" />}>
                    Waze
                  </ActionChip>
                </>
              )}
              {s.phone && (
                <ActionChip href={telUrl(s.phone)} icon={<Phone className="size-3.5" />}>
                  {tr("call")}
                </ActionChip>
              )}
              {s.url && (
                <ActionChip href={s.url} icon={<ExternalLink className="size-3.5" />}>
                  {tr("open")}
                </ActionChip>
              )}
            </div>
          </Card>
        );
      })}

      {links.map((s) => {
        const href = s.url || loc(s.detail).trim();
        return (
          <a
            key={s.id}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 rounded-[1.6rem] bg-night p-5 text-ivory"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-gold/40 text-xl">🗺️</span>
            <span className="flex-1 font-serif text-xl">{s.name}</span>
            <ExternalLink className="size-4 text-gold-light" />
          </a>
        );
      })}
    </div>
  );
}

/* ---------------------------------- Météo ---------------------------------- */

export function WeatherPage() {
  const { data, tr, lang } = useLivret();
  const { data: w, loading } = useWeather(data.livret.city, data.livret.latitude, data.livret.longitude);
  const fmt = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", { weekday: "short", day: "numeric" });

  if (loading) return <div className="h-72 animate-pulse rounded-[1.6rem] bg-sand" />;
  if (!w) return <Card className="text-center text-sm text-stone">{tr("weatherError")}</Card>;

  const today = w.days[0];
  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[1.8rem] bg-[radial-gradient(circle_at_80%_0%,#18204a,#070c1c_70%)] p-6 text-ivory">
        <div className="grain absolute inset-0" />
        <div className="relative">
          <p className="text-[11px] tracking-[0.25em] text-gold-light/80 uppercase">
            {data.livret.city} · {tr("now")}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <p className="font-serif text-7xl leading-none">{w.current.temp}°</p>
            <span className="text-6xl">{weatherIcon(w.current.code)}</span>
          </div>
          <p className="mt-2 text-ivory/80">{weatherLabel(w.current.code, lang)}</p>
          <div className="mt-6 grid grid-cols-4 gap-2 border-t border-white/10 pt-4 text-center">
            {[
              [tr("max"), `${today.max}°`],
              [tr("min"), `${today.min}°`],
              [tr("rain"), `${today.rain}%`],
              [tr("wind"), `${w.current.wind} km/h`],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-[10px] tracking-[0.15em] text-ivory/50 uppercase">{k}</p>
                <p className="mt-1 text-sm font-semibold text-gold-light">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Card className="divide-y divide-[#f0e9db] p-0">
        {w.days.slice(1).map((d) => (
          <div key={d.date} className="flex items-center gap-3 px-5 py-3.5">
            <span className="w-20 text-sm font-semibold text-ink capitalize">{fmt.format(new Date(`${d.date}T12:00`))}</span>
            <span className="text-2xl">{weatherIcon(d.code)}</span>
            <span className="flex-1 text-xs text-stone">💧 {d.rain}%</span>
            <span className="text-sm font-semibold text-ink">{d.max}°</span>
            <span className="w-8 text-right text-sm text-stone">{d.min}°</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* --------------------------------- Départ --------------------------------- */

export function DeparturePage() {
  const { data, tr, loc, lang } = useLivret();
  const storageKey = `elypse-checkout-${data.token}`;
  const lines = loc(data.livret.checkoutInstructions)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const tasks = lines.filter((s) => /^[-–•]/.test(s)).map((s) => s.replace(/^[-–•]\s*/, ""));
  const notes = lines.filter((s) => !/^[-–•]/.test(s));
  const [done, setDone] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    } catch {
      return [];
    }
  });

  function toggle(i: number) {
    const next = done.includes(i) ? done.filter((d) => d !== i) : [...done, i];
    setDone(next);
    navigator.vibrate?.(8);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  }

  return (
    <div className="space-y-6">
      <TimeBanner icon={<Clock className="size-5" />} label={tr("checkoutTime")} value={data.livret.checkoutTime} />

      {tasks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h3 className="font-serif text-2xl text-ink">{tr("beforeLeaving")}</h3>
            <span className="text-xs font-semibold text-gold-deep">
              {done.length}/{tasks.length}
            </span>
          </div>
          <p className="text-xs text-stone">{tr("checklistHint")}</p>
          <ul className="space-y-2">
            {tasks.map((task, i) => {
              const checked = done.includes(i);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                      checked ? "border-gold/40 bg-[#f7f0e1]" : "border-[#ebe3d3] bg-white",
                    )}
                    aria-pressed={checked}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition",
                        checked ? "border-transparent bg-gold-foil text-night" : "border-[#d9cdb5]",
                      )}
                    >
                      {checked && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className={cn("text-[15px] leading-snug", checked ? "text-ink/50 line-through decoration-gold/60" : "text-ink/85")}>
                      {task}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {notes.length > 0 && (
        <div className="flex gap-3 rounded-[1.4rem] bg-[#f6f0e2] p-4 text-[15px] leading-relaxed text-ink/80">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-gold-deep" />
          <p className="whitespace-pre-line">{notes.join("\n")}</p>
        </div>
      )}

      <div className="relative overflow-hidden rounded-[1.8rem] bg-night px-6 py-8 text-center text-ivory">
        <div className="grain absolute inset-0" />
        <Sparkles className="relative mx-auto size-6 text-gold-light" />
        <p className="relative mt-3 font-serif text-[1.7rem] leading-tight">{tr("thanks")}</p>
        <p className="relative mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ivory/70">{tr("thanksText")}</p>
        <p className="relative mt-4 text-[11px] tracking-[0.3em] text-gold/80 uppercase">{lang === "en" ? "See you soon" : "À bientôt"}</p>
      </div>
    </div>
  );
}

/* ------------------------------- Assistance -------------------------------- */

export function AssistancePage() {
  const { data, tr, loc, lang } = useLivret();
  const l = data.livret;
  const phone = l.contactPhone;
  const intl = phone.replace(/[^\d+]/g, "").replace(/^0(?=\d{9}$)/, "33").replace(/^\+/, "");

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[1.8rem] bg-[radial-gradient(circle_at_50%_-20%,#18204a,#070c1c_70%)] p-6 text-ivory">
        <div className="grain absolute inset-0" />
        <div className="relative text-center">
          <p className="text-[11px] tracking-[0.25em] text-gold-light/80 uppercase">{tr("host")}</p>
          <p className="mt-2 font-serif text-3xl">{l.contactName}</p>
          {l.contactSubtitle && <p className="text-sm text-ivory/60">{l.contactSubtitle}</p>}
          {phone && <p className="mt-4 font-mono text-lg tracking-wider text-gold-light">{phone}</p>}
        </div>
        {phone && (
          <div className="relative mt-6 grid grid-cols-3 gap-2">
            <a href={telUrl(phone)} className="bg-gold-foil flex h-12 flex-col items-center justify-center rounded-2xl text-night">
              <Phone className="size-4" />
              <span className="text-[11px] font-bold">{tr("call")}</span>
            </a>
            <a href={`sms:${phone.replace(/\s/g, "")}`} className="flex h-12 flex-col items-center justify-center rounded-2xl bg-white/10 text-ivory">
              <MessageCircle className="size-4" />
              <span className="text-[11px] font-semibold">{tr("sms")}</span>
            </a>
            <a href={`https://wa.me/${intl}`} target="_blank" rel="noreferrer" className="flex h-12 flex-col items-center justify-center rounded-2xl bg-white/10 text-ivory">
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z" />
              </svg>
              <span className="text-[11px] font-semibold">{tr("whatsapp")}</span>
            </a>
          </div>
        )}
        {l.contactEmail && (
          <a href={`mailto:${l.contactEmail}`} className="relative mt-2 flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 text-sm text-ivory/85">
            <Mail className="size-4 text-gold-light" /> <span className="truncate">{l.contactEmail}</span>
          </a>
        )}
      </div>

      {data.contacts.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-serif text-2xl text-ink">{tr("usefulContacts")}</h3>
          {data.contacts.map((c) => {
            const type = findOption(CONTACT_TYPES, c.type);
            const href = c.phone ? telUrl(c.phone) : c.address ? mapsUrl(c.address) : undefined;
            return (
              <Card key={c.id} className="flex items-start gap-4 p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-xl">{type.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold tracking-[0.15em] text-gold-deep uppercase">{lang === "en" ? type.en : type.fr}</p>
                  <p className="font-semibold text-ink">{c.name}</p>
                  <Prose text={loc(c.detail)} className="text-[13.5px] text-ink/65" />
                  {c.address && (
                    <a href={mapsUrl(c.address)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-stone underline-offset-2 hover:underline">
                      <MapPin className="size-3" /> {c.address}
                    </a>
                  )}
                </div>
                {href && c.phone && (
                  <a href={href} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-night text-gold-light" aria-label={tr("call")}>
                    <Phone className="size-4" />
                  </a>
                )}
              </Card>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="font-serif text-2xl text-ink">{tr("emergency")}</h3>
        <div className="grid grid-cols-2 gap-2">
          {EMERGENCY_NUMBERS.map((e) => (
            <a key={e.number} href={`tel:${e.number}`} className="flex items-center gap-3 rounded-2xl border border-[#ebe3d3] bg-white p-3.5 transition active:scale-[0.98]">
              <span className="text-2xl">{e.icon}</span>
              <span className="min-w-0">
                <span className="block font-serif text-2xl leading-none text-ink">{e.number}</span>
                <span className="block truncate text-[11px] text-stone">{lang === "en" ? e.en : e.fr}</span>
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
