import type { Metadata } from "next";
import { LivretCard } from "@/components/dashboard/livret-card";
import { getBaseUrl, livretPath } from "@/lib/base-url";
import { prisma } from "@/lib/db";
import { asLocalized } from "@/lib/localized";

export const metadata: Metadata = { title: "Livrets" };

export default async function DashboardPage() {
  const [livrets, baseUrl] = await Promise.all([
    prisma.livret.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { recommendations: true, equipments: true, transports: true, contacts: true } },
      },
    }),
    getBaseUrl(),
  ]);

  const activeCount = livrets.filter((l) => l.active).length;

  return (
    <main className="mx-auto max-w-7xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="animate-rise">
          <p className="text-[11px] font-medium tracking-[0.3em] text-gold-deep uppercase">Gestion</p>
          <h1 className="mt-2 font-serif text-4xl leading-none text-ink sm:text-5xl">Livrets d&apos;accueil</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {livrets.length} livret{livrets.length > 1 ? "s" : ""} · {activeCount} actif
            {activeCount > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="gold-hairline my-8 h-px opacity-50" />

      {livrets.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gold/40 bg-white/60 px-6 py-20 text-center">
          <p className="font-serif text-2xl text-ink">Aucun livret pour le moment</p>
        </div>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {livrets.map((l, i) => (
            <li key={l.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
              <LivretCard
                livret={{
                  id: l.id,
                  name: l.name,
                  title: l.title,
                  address: [l.address, l.city].filter(Boolean).join(", "),
                  active: l.active,
                  coverImageId: l.coverImageId,
                  url: `${baseUrl}${livretPath(l.token)}`,
                  hasWifi: Boolean(l.wifiSsid),
                  hasRules: Boolean(asLocalized(l.rules).fr),
                  counts: {
                    recos: l._count.recommendations,
                    equipements: l._count.equipments,
                    transport: l._count.transports,
                    contacts: l._count.contacts,
                  },
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
