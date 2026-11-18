import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChargesManager } from "@/components/finances/charges-manager";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayInParis } from "@/lib/finances/filters";
import { loadCharges } from "@/lib/finances/load";

export const metadata: Metadata = { title: "Charges" };

export default async function ChargesPage() {
  await requireSession();
  const [biens, charges] = await Promise.all([
    prisma.bien.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, excludedFromReports: true },
    }),
    loadCharges(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
      <Link href="/dashboard/finances" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-ink">
        <ArrowLeft className="size-4" /> Finances
      </Link>
      <div className="mt-4 animate-rise">
        <p className="text-[11px] font-medium tracking-[0.3em] text-gold-deep uppercase">Finances</p>
        <h1 className="mt-2 font-serif text-4xl leading-none text-ink sm:text-5xl">Charges</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Vos charges fixes mensuelles, bien par bien : loyer, leasing du mobilier, électricité… Elles sont déduites du
          bénéfice dans les rapports, TVA comprise, et comptées au jour près. Quand un montant change, indiquez la date
          à partir de laquelle il s&apos;applique : les mois précédents gardent l&apos;ancien montant, et chaque saisie
          reste dans l&apos;historique.
        </p>
      </div>

      <div className="gold-hairline my-8 h-px opacity-50" />

      <ChargesManager
        today={todayInParis()}
        biens={biens.map((b) => ({
          id: b.id,
          name: b.name,
          excluded: b.excludedFromReports,
          charges: charges.filter((c) => c.bienId === b.id),
        }))}
      />
    </main>
  );
}
