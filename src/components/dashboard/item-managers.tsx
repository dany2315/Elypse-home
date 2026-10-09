"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteItem, type ItemKind, reorderItems, saveItem } from "@/app/dashboard/actions";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTACT_TYPES,
  EQUIPMENT_CATEGORIES,
  findOption,
  RECO_CATEGORIES,
  TRANSPORT_TYPES,
  TRAVEL_MODES,
} from "@/lib/catalog";
import { imageUrl } from "@/lib/image-url";
import type { ContactItem, EquipmentItem, RecoItem, TransportItem } from "@/lib/livret-data";
import { cn } from "@/lib/utils";
import { BiField, Field, TextField } from "./fields";
import { ImageUpload } from "./image-upload";

/* ------------------------------ Générique ------------------------------ */

type Row = { icon: React.ReactNode; title: string; subtitle?: string; meta?: string };

type ManagerProps<T extends { id: string }> = {
  kind: ItemKind;
  livretId: string;
  items: T[];
  title: string;
  description: string;
  addLabel: string;
  empty: string;
  blank: () => Omit<T, "id">;
  row: (item: T) => Row;
  form: (draft: Omit<T, "id">, set: (patch: Partial<Omit<T, "id">>) => void) => React.ReactNode;
};

function SortableRow({
  id,
  row,
  onEdit,
  onDelete,
}: {
  id: string;
  row: Row;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-2xl border bg-card p-2 pr-3 transition-shadow sm:gap-3",
        isDragging && "relative z-10 shadow-xl ring-1 ring-gold/40",
      )}
    >
      <button
        type="button"
        className="flex h-10 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground/60 hover:bg-muted active:cursor-grabbing"
        aria-label="Réordonner"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent text-xl">
        {row.icon}
      </div>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[15px] font-semibold text-ink">{row.title}</p>
        {row.subtitle && <p className="truncate text-xs text-muted-foreground">{row.subtitle}</p>}
      </button>
      {row.meta && (
        <span className="hidden shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline">
          {row.meta}
        </span>
      )}
      <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Modifier">
        <Pencil />
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Supprimer" className="text-muted-foreground hover:text-destructive">
        <Trash2 />
      </Button>
    </li>
  );
}

function ItemsManager<T extends { id: string }>({
  kind,
  livretId,
  items: initialItems,
  title,
  description,
  addLabel,
  empty,
  blank,
  row,
  form,
}: ManagerProps<T>) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<{ id: string | null; draft: Omit<T, "id"> } | null>(null);
  const [toDelete, setToDelete] = useState<T | null>(null);
  const [pending, startTransition] = useTransition();

  // Resynchronise la liste quand le serveur renvoie de nouvelles données.
  const [source, setSource] = useState(initialItems);
  if (source !== initialItems) {
    setSource(initialItems);
    setItems(initialItems);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const next = arrayMove(
      items,
      items.findIndex((i) => i.id === active.id),
      items.findIndex((i) => i.id === over.id),
    );
    setItems(next);
    startTransition(async () => {
      const res = await reorderItems(kind, livretId, next.map((i) => i.id));
      if (!res.ok) toast.error(res.error);
    });
  }

  function save() {
    if (!editing) return;
    startTransition(async () => {
      const res = await saveItem(kind, livretId, editing.id, editing.draft as never);
      if (!res.ok) return void toast.error(res.error);
      toast.success(editing.id ? "Modifications enregistrées" : "Élément ajouté");
      setEditing(null);
      router.refresh();
    });
  }

  function remove() {
    if (!toDelete) return;
    const target = toDelete;
    startTransition(async () => {
      const res = await deleteItem(kind, target.id);
      if (!res.ok) return void toast.error(res.error);
      setItems((list) => list.filter((i) => i.id !== target.id));
      setToDelete(null);
      toast.success("Élément supprimé");
      router.refresh();
    });
  }

  const openNew = () => setEditing({ id: null, draft: blank() });
  const openEdit = (item: T) => {
    const { id, ...draft } = item;
    setEditing({ id, draft });
  };

  return (
    <section className="rounded-3xl border bg-card p-5 shadow-[0_20px_40px_-34px_rgba(18,22,42,.4)] sm:p-7">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl leading-tight text-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={openNew} className="shrink-0 self-start">
          <Plus /> {addLabel}
        </Button>
      </header>

      {items.length === 0 ? (
        <button
          type="button"
          onClick={openNew}
          className="w-full rounded-2xl border border-dashed border-gold/40 bg-accent/30 px-6 py-12 text-center text-sm text-muted-foreground transition hover:bg-accent/60"
        >
          {empty}
        </button>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {items.map((item) => (
                <SortableRow
                  key={item.id}
                  id={item.id}
                  row={row(item)}
                  onEdit={() => openEdit(item)}
                  onDelete={() => setToDelete(item)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && !pending && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-medium">
              {editing?.id ? "Modifier" : addLabel}
            </DialogTitle>
            <DialogDescription>Les champs anglais sont facultatifs : le français est utilisé à défaut.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-5 py-2">
              {form(editing.draft, (patch) =>
                setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e)),
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={pending}>
              Annuler
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet élément ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est définitive.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
            >
              {pending && <Loader2 className="animate-spin" />} Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function OptionSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; icon: string; fr: string }[];
}) {
  return (
    <Field label={label}>
      <Select value={value || "__none"} onValueChange={(v) => onChange(v === "__none" ? "" : v)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value || "__none"} value={o.value || "__none"}>
              {o.icon} {o.fr}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

const thumb = (imageId: string | null, fallback: string) =>
  imageId ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl(imageId)!} alt="" className="size-full object-cover" />
  ) : (
    fallback
  );

/* ---------------------------- Recommandations ---------------------------- */

export function RecosManager({ livretId, items }: { livretId: string; items: RecoItem[] }) {
  return (
    <ItemsManager<RecoItem>
      kind="recommendation"
      livretId={livretId}
      items={items}
      title="Recommandations"
      description="Restaurants, cafés, boulangeries, sorties… Regroupés par catégorie dans le livret."
      addLabel="Ajouter une adresse"
      empty="Aucune recommandation. Ajoutez vos meilleures adresses du quartier."
      blank={() => ({
        name: "",
        category: "restaurant",
        address: "",
        description: { fr: "", en: "" },
        imageId: null,
        phone: "",
        website: "",
        travelTime: "",
        travelMode: "pied",
      })}
      row={(r) => {
        const cat = findOption(RECO_CATEGORIES, r.category);
        return {
          icon: thumb(r.imageId, cat.icon),
          title: r.name,
          subtitle: [cat.fr, r.address].filter(Boolean).join(" · "),
          meta: r.travelTime ? `${findOption(TRAVEL_MODES, r.travelMode).icon} ${r.travelTime}` : undefined,
        };
      }}
      form={(d, set) => (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Nom" value={d.name} onChange={(name) => set({ name })} placeholder="ex : Bistrot Richelieu" />
            <OptionSelect label="Catégorie" value={d.category} onChange={(category) => set({ category })} options={RECO_CATEGORIES} />
          </div>
          <TextField
            label="Adresse"
            hint="Utilisée pour les boutons Google Maps et Waze."
            value={d.address}
            onChange={(address) => set({ address })}
            placeholder="45 rue de Richelieu, 75001 Paris"
          />
          <BiField label="Description" multiline value={d.description} onChange={(description) => set({ description })} />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Téléphone (réservation)" type="tel" value={d.phone} onChange={(phone) => set({ phone })} />
            <TextField label="Site web" value={d.website} onChange={(website) => set({ website })} placeholder="https://" />
            <TextField label="Temps de trajet" value={d.travelTime} onChange={(travelTime) => set({ travelTime })} placeholder="5 min" />
            <OptionSelect label="Mode de trajet" value={d.travelMode} onChange={(travelMode) => set({ travelMode })} options={TRAVEL_MODES} />
          </div>
          <Field label="Photo (facultatif)">
            <ImageUpload value={d.imageId} onChange={(imageId) => set({ imageId })} aspect="aspect-[2/1]" />
          </Field>
        </>
      )}
    />
  );
}

/* ------------------------------ Équipements ------------------------------ */

export function EquipmentsManager({ livretId, items }: { livretId: string; items: EquipmentItem[] }) {
  return (
    <ItemsManager<EquipmentItem>
      kind="equipment"
      livretId={livretId}
      items={items}
      title="Équipements"
      description="Modes d'emploi des appareils, regroupés par pièce."
      addLabel="Ajouter un équipement"
      empty="Aucun équipement. Ajoutez la machine à café, la TV, le lave-linge…"
      blank={() => ({
        name: { fr: "", en: "" },
        category: "cuisine",
        icon: "",
        instructions: { fr: "", en: "" },
        imageId: null,
        tip: { fr: "", en: "" },
        tipType: "info",
      })}
      row={(e) => {
        const cat = findOption(EQUIPMENT_CATEGORIES, e.category);
        return {
          icon: thumb(e.imageId, e.icon || cat.icon),
          title: e.name.fr,
          subtitle: `${cat.icon} ${cat.fr}`,
        };
      }}
      form={(d, set) => (
        <>
          <BiField label="Nom" value={d.name} onChange={(name) => set({ name })} placeholder={{ fr: "Cafetière Nespresso", en: "Nespresso machine" }} />
          <div className="grid gap-5 sm:grid-cols-2">
            <OptionSelect label="Pièce" value={d.category} onChange={(category) => set({ category })} options={EQUIPMENT_CATEGORIES} />
            <TextField label="Icône (emoji)" value={d.icon} onChange={(icon) => set({ icon })} placeholder="☕" maxLength={4} />
          </div>
          <BiField label="Mode d'emploi" multiline value={d.instructions} onChange={(instructions) => set({ instructions })} />
          <BiField label="Astuce (facultatif)" value={d.tip} onChange={(tip) => set({ tip })} />
          <OptionSelect
            label="Type d'astuce"
            value={d.tipType}
            onChange={(tipType) => set({ tipType })}
            options={[
              { value: "info", icon: "💡", fr: "Conseil" },
              { value: "warning", icon: "⚠️", fr: "Avertissement" },
            ]}
          />
          <Field label="Photo (facultatif)">
            <ImageUpload value={d.imageId} onChange={(imageId) => set({ imageId })} aspect="aspect-[2/1]" />
          </Field>
        </>
      )}
    />
  );
}

/* ------------------------------- Transport ------------------------------- */

export function TransportsManager({ livretId, items }: { livretId: string; items: TransportItem[] }) {
  return (
    <ItemsManager<TransportItem>
      kind="transport"
      livretId={livretId}
      items={items}
      title="Transport"
      description="Stations de métro, RER, bus, gares et liens utiles (plan du métro…)."
      addLabel="Ajouter un transport"
      empty="Aucun transport. Ajoutez les stations les plus proches."
      blank={() => ({
        name: "",
        type: "metro",
        line: "",
        color: "",
        detail: { fr: "", en: "" },
        phone: "",
        address: "",
        url: "",
      })}
      row={(t) => {
        const type = findOption(TRANSPORT_TYPES, t.type);
        return {
          icon: t.line ? (
            <span
              className="flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white"
              style={{ background: t.color || "#0d1430" }}
            >
              {t.line.length > 6 ? type.icon : t.line}
            </span>
          ) : (
            type.icon
          ),
          title: t.name,
          subtitle: [type.fr, t.line && `Ligne ${t.line}`].filter(Boolean).join(" · "),
        };
      }}
      form={(d, set) => (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Nom" value={d.name} onChange={(name) => set({ name })} placeholder="ex : Tuileries" />
            <OptionSelect label="Type" value={d.type} onChange={(type) => set({ type })} options={TRANSPORT_TYPES} />
            <TextField label="Ligne(s)" value={d.line} onChange={(line) => set({ line })} placeholder="1 · 7 · 14" />
            <Field label="Couleur du badge">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(d.color) ? d.color : "#0d1430"}
                  onChange={(e) => set({ color: e.target.value })}
                  className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
                  aria-label="Choisir la couleur"
                />
                <TextField label="" value={d.color} onChange={(color) => set({ color })} placeholder="#FFCD00" className="flex-1 space-y-0" />
              </div>
            </Field>
          </div>
          <BiField label="Détail" multiline value={d.detail} onChange={(detail) => set({ detail })} />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Adresse (Maps / Waze)" value={d.address} onChange={(address) => set({ address })} />
            <TextField label="Téléphone (taxi…)" type="tel" value={d.phone} onChange={(phone) => set({ phone })} />
          </div>
          <TextField label="Lien (plan, site…)" value={d.url} onChange={(url) => set({ url })} placeholder="https://www.ratp.fr/plan-metro" />
        </>
      )}
    />
  );
}

/* -------------------------------- Contacts ------------------------------- */

export function ContactsManager({ livretId, items }: { livretId: string; items: ContactItem[] }) {
  return (
    <ItemsManager<ContactItem>
      kind="contact"
      livretId={livretId}
      items={items}
      title="Contacts utiles"
      description="Pharmacies, médecins, téléconsultation… Affichés sous les numéros d'urgence (15, 17, 18, 112 déjà inclus)."
      addLabel="Ajouter un contact"
      empty="Aucun contact utile. Ajoutez la pharmacie la plus proche par exemple."
      blank={() => ({ name: "", type: "pharmacie", phone: "", address: "", detail: { fr: "", en: "" } })}
      row={(c) => {
        const type = findOption(CONTACT_TYPES, c.type);
        return { icon: type.icon, title: c.name, subtitle: [type.fr, c.phone].filter(Boolean).join(" · ") };
      }}
      form={(d, set) => (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Nom" value={d.name} onChange={(name) => set({ name })} placeholder="ex : Pharmacie de l'Opéra" />
            <OptionSelect label="Type" value={d.type} onChange={(type) => set({ type })} options={CONTACT_TYPES} />
            <TextField label="Téléphone" type="tel" value={d.phone} onChange={(phone) => set({ phone })} />
            <TextField label="Adresse (Maps / Waze)" value={d.address} onChange={(address) => set({ address })} />
          </div>
          <BiField label="Détail" multiline rows={3} value={d.detail} onChange={(detail) => set({ detail })} />
        </>
      )}
    />
  );
}
