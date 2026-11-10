import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BiensManager } from "@/components/finances/biens-manager";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Biens et listings" };

export default async function BiensPage() {
  await requireSession();
  const [biens, orphans, livrets] = await Promise.all([
    prisma.bien.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        listings: {
          orderBy: { id: "asc" },
          include: { _count: { select: { reservations: true } } },
        },
      },
    }),
    prisma.hostawayListing.count({ where: { bienId: null } }),
    prisma.livret.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
      <Link href="/dashboard/finances" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-ink">
        <ArrowLeft className="size-4" /> Finances
      </Link>
      <div className="mt-4 animate-rise">
        <p className="text-[11px] font-medium tracking-[0.3em] text-gold-deep uppercase">Finances</p>
        <h1 className="mt-2 font-serif text-4xl leading-none text-ink sm:text-5xl">Biens et listings</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Un bien regroupe un ou plusieurs listings Hostaway (par exemple un listing par annonce Booking). Les rapports sont
          calculés par bien. Un bien est proposé automatiquement pour chaque nouveau listing : fusionnez ceux qui
          correspondent au même logement.
        </p>
      </div>

      <div className="gold-hairline my-8 h-px opacity-50" />

      <BiensManager
        orphanCount={orphans}
        livrets={livrets}
        biens={biens.map((b) => ({
          id: b.id,
          name: b.name,
          livretId: b.livretId,
          listings: b.listings.map((l) => ({
            id: l.id,
            name: l.internalName || l.name,
            publicName: l.internalName && l.name !== l.internalName ? l.name : "",
            channels: l.channels,
            active: l.active,
            reservations: l._count.reservations,
          })),
        }))}
      />
    </main>
  );
}
