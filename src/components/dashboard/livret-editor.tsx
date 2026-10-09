"use client";

import { ArrowLeft, Eye, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateLivret } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ACCESS_TYPES } from "@/lib/catalog";
import type {
  ContactItem,
  EquipmentItem,
  LivretForm,
  RecoItem,
  TransportItem,
} from "@/lib/livret-data";
import { cn } from "@/lib/utils";
import { BiField, Field, Section, TextField } from "./fields";
import { ImageUpload, MultiImageUpload } from "./image-upload";
import { ContactsManager, EquipmentsManager, RecosManager, TransportsManager } from "./item-managers";
import { LivretLinkButton } from "./livret-link";

const TABS = [
  { value: "general", label: "Général" },
  { value: "arrivee", label: "Arrivée" },
  { value: "sejour", label: "Séjour" },
  { value: "depart", label: "Départ" },
  { value: "assistance", label: "Assistance" },
  { value: "recommandations", label: "Recommandations" },
  { value: "equipements", label: "Équipements" },
  { value: "transport", label: "Transport" },
  { value: "contacts", label: "Contacts utiles" },
] as const;
type Tab = (typeof TABS)[number]["value"];
const FORM_TABS: Tab[] = ["general", "arrivee", "sejour", "depart", "assistance"];

export function LivretEditor({
  id,
  url,
  initialTab,
  initial,
  recommendations,
  equipments,
  transports,
  contacts,
}: {
  id: string;
  url: string;
  initialTab: string;
  initial: LivretForm;
  recommendations: RecoItem[];
  equipments: EquipmentItem[];
  transports: TransportItem[];
  contacts: ContactItem[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(
    (TABS.find((t) => t.value === initialTab)?.value ?? "general") as Tab,
  );
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  const set = <K extends keyof LivretForm>(key: K) => (value: LivretForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function changeTab(next: Tab) {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", next);
    window.history.replaceState(null, "", `?${params}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function save() {
    startTransition(async () => {
      const res = await updateLivret(id, form);
      if (!res.ok) return void toast.error(res.error);
      setSaved(form);
      toast.success("Livret enregistré");
      router.refresh();
    });
  }

  const counts: Partial<Record<Tab, number>> = {
    recommandations: recommendations.length,
    equipements: equipments.length,
    transport: transports.length,
    contacts: contacts.length,
  };

  return (
    <div className="pb-32">
      {/* En-tête */}
      <div className="border-b bg-card/60">
        <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground transition hover:text-ink"
          >
            <ArrowLeft className="size-3.5" /> Tous les livrets
          </Link>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.3em] text-gold-deep uppercase">{form.name || "Livret"}</p>
              <h1 className="mt-1 font-serif text-3xl leading-tight text-ink sm:text-4xl">{form.title || "Sans titre"}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <label className="mr-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={form.active} onCheckedChange={set("active")} />
                {form.active ? "Actif" : "Inactif"}
              </label>
              <Button variant="outline" asChild>
                <Link href={`/dashboard/livrets/${id}/apercu`}>
                  <Eye /> Aperçu
                </Link>
              </Button>
              <LivretLinkButton livretId={id} url={url} name={form.name} onRegenerated={() => router.refresh()} />
            </div>
          </div>

          <nav className="scrollbar-none -mx-4 mt-6 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => changeTab(t.value)}
                className={cn(
                  "relative shrink-0 rounded-t-lg px-3.5 pt-2 pb-3 text-sm font-medium whitespace-nowrap transition",
                  tab === t.value ? "text-ink" : "text-muted-foreground hover:text-ink",
                )}
              >
                {t.label}
                {counts[t.value] ? (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {counts[t.value]}
                  </span>
                ) : null}
                {tab === t.value && <span className="bg-gold-foil absolute inset-x-2 bottom-0 h-[2px] rounded-full" />}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-4 pt-8 sm:px-6">
        {tab === "general" && (
          <>
            <Section title="Informations générales" description="Ce que le voyageur voit en premier.">
              <div className="grid gap-5 md:grid-cols-2">
                <TextField label="Nom interne" hint="Visible uniquement dans le dashboard." value={form.name} onChange={set("name")} />
                <TextField label="Titre du livret" value={form.title} onChange={set("title")} />
                <TextField label="Adresse" value={form.address} onChange={set("address")} placeholder="18 rue de la Sourdière" />
                <TextField label="Ville" value={form.city} onChange={set("city")} placeholder="Paris" />
              </div>
              <Field label="Photo de couverture" hint="Format paysage conseillé. Elle apparaît en haut du livret.">
                <ImageUpload value={form.coverImageId} onChange={set("coverImageId")} />
              </Field>
            </Section>
            <Section
              title="Météo"
              description="Facultatif : coordonnées GPS précises. Sans elles, la météo de la ville est utilisée."
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Latitude"
                  inputMode="decimal"
                  value={form.latitude?.toString() ?? ""}
                  onChange={(v) => set("latitude")((v === "" ? null : v) as unknown as number | null)}
                  placeholder="48.8566"
                />
                <TextField
                  label="Longitude"
                  inputMode="decimal"
                  value={form.longitude?.toString() ?? ""}
                  onChange={(v) => set("longitude")((v === "" ? null : v) as unknown as number | null)}
                  placeholder="2.3522"
                />
              </div>
            </Section>
          </>
        )}

        {tab === "arrivee" && (
          <>
            <Section title="Arrivée" description="Les étapes pour entrer dans le logement.">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Heure de check-in" value={form.checkinTime} onChange={set("checkinTime")} placeholder="16:00" />
                <TextField label="Code d'entrée de l'immeuble" value={form.buildingCode} onChange={set("buildingCode")} placeholder="34589" />
              </div>
              <BiField label="Instructions immeuble" multiline value={form.buildingInstructions} onChange={set("buildingInstructions")} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Type d'accès">
                  <Select value={form.accessType || "none"} onValueChange={(v) => set("accessType")(v === "none" ? "" : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCESS_TYPES.map((a) => (
                        <SelectItem key={a.value || "none"} value={a.value || "none"}>
                          {a.fr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <TextField label="Code boîte à clés" value={form.keyboxCode} onChange={set("keyboxCode")} placeholder="7501" />
              </div>
              <BiField label="Instructions clés" multiline value={form.keyInstructions} onChange={set("keyInstructions")} />
              <BiField
                label="Message de bienvenue"
                hint="Laissez vide pour le message par défaut."
                multiline
                rows={3}
                value={form.welcomeMessage}
                onChange={set("welcomeMessage")}
              />
            </Section>
            <Section title="Repères visuels" description="Photos de la devanture / porte d'entrée et vidéo du trajet.">
              <Field label="Photos devanture">
                <MultiImageUpload value={form.facadeImageIds} onChange={set("facadeImageIds")} />
              </Field>
              <TextField
                label="Vidéo du trajet (lien)"
                hint="Lien YouTube, Google Drive, iCloud… (facultatif)"
                value={form.videoUrl}
                onChange={set("videoUrl")}
                placeholder="https://"
              />
            </Section>
          </>
        )}

        {tab === "sejour" && (
          <>
            <Section title="Wifi">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Nom du réseau" value={form.wifiSsid} onChange={set("wifiSsid")} />
                <TextField label="Mot de passe" value={form.wifiPassword} onChange={set("wifiPassword")} />
              </div>
            </Section>
            <Section title="Parking">
              <BiField label="Instructions parking" multiline value={form.parking} onChange={set("parking")} />
            </Section>
            <Section title="Essentiels fournis">
              <BiField
                label="Liste"
                hint="Séparez les éléments par des virgules."
                value={form.essentials}
                onChange={set("essentials")}
                placeholder={{ fr: "Capsules de café, Shampoing, Gel douche", en: "Coffee capsules, Shampoo, Shower gel" }}
              />
            </Section>
            <Section title="Règles de la maison" description="Une règle par ligne. Une ligne commençant par un emoji devient un titre.">
              <BiField label="Règles" multiline rows={10} value={form.rules} onChange={set("rules")} />
            </Section>
          </>
        )}

        {tab === "depart" && (
          <Section title="Départ" description="Chaque ligne devient une case à cocher pour le voyageur.">
            <TextField label="Heure de check-out" value={form.checkoutTime} onChange={set("checkoutTime")} placeholder="10:00" className="sm:max-w-xs" />
            <BiField label="Consignes de départ" multiline rows={9} value={form.checkoutInstructions} onChange={set("checkoutInstructions")} />
          </Section>
        )}

        {tab === "assistance" && (
          <Section title="Contact & assistance" description="Coordonnées affichées sur la page Assistance du livret.">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="Nom du contact" value={form.contactName} onChange={set("contactName")} />
              <TextField label="Sous-titre" value={form.contactSubtitle} onChange={set("contactSubtitle")} />
              <TextField label="Téléphone" type="tel" value={form.contactPhone} onChange={set("contactPhone")} />
              <TextField label="Email" type="email" value={form.contactEmail} onChange={set("contactEmail")} />
              <TextField label="Texte du pied de page" value={form.footerText} onChange={set("footerText")} />
            </div>
          </Section>
        )}

        {tab === "recommandations" && <RecosManager livretId={id} items={recommendations} />}
        {tab === "equipements" && <EquipmentsManager livretId={id} items={equipments} />}
        {tab === "transport" && <TransportsManager livretId={id} items={transports} />}
        {tab === "contacts" && <ContactsManager livretId={id} items={contacts} />}
      </div>

      {/* Barre d'enregistrement */}
      <div
        className={cn(
          "pb-safe fixed inset-x-0 bottom-0 z-40 px-4 transition duration-300 sm:px-6",
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
        )}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-night px-4 py-3 text-ivory shadow-2xl">
          <p className="text-sm text-ivory/80">
            Modifications non enregistrées
            {!FORM_TABS.includes(tab) && <span className="hidden sm:inline"> (onglets Général à Assistance)</span>}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="text-ivory hover:bg-white/10 hover:text-ivory"
              onClick={() => setForm(saved)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button onClick={save} disabled={pending} className="bg-gold-foil text-night hover:brightness-110">
              {pending ? <Loader2 className="animate-spin" /> : <Save />} Enregistrer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

