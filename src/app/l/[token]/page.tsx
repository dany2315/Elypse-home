import type { Metadata } from "next";
import Image from "next/image";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { GuestLivret } from "@/components/livret/guest-livret";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  toContactItem,
  toEquipmentItem,
  toLivretForm,
  toRecoItem,
  toTransportItem,
} from "@/lib/livret-data";

const order = { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] };

const getLivret = cache((token: string) =>
  prisma.livret.findUnique({
    where: { token },
    include: { recommendations: order, equipments: order, transports: order, contacts: order },
  }),
);

export async function generateMetadata(props: PageProps<"/l/[token]">): Promise<Metadata> {
  const { token } = await props.params;
  const livret = await getLivret(token);
  return {
    title: livret ? { absolute: `${livret.title} — Livret d'accueil` } : "Livret indisponible",
    robots: { index: false, follow: false },
    appleWebApp: { capable: true, title: "Elypse Home", statusBarStyle: "black-translucent" },
  };
}

export default async function LivretPublicPage(props: PageProps<"/l/[token]">) {
  const { token } = await props.params;
  const livret = await getLivret(token);

  // Un livret inactif reste visible pour l'administrateur connecté (aperçu).
  const visible = livret && (livret.active || (await getSession()));
  if (!livret || !visible) return <Unavailable />;

  const lang = await guestLang();

  return (
    <GuestLivret
      initialLang={lang}
      data={{
        token,
        livret: toLivretForm(livret),
        recommendations: livret.recommendations.map(toRecoItem),
        equipments: livret.equipments.map(toEquipmentItem),
        transports: livret.transports.map(toTransportItem),
        contacts: livret.contacts.map(toContactItem),
      }}
    />
  );
}

/** Langue choisie par le voyageur (cookie), sinon celle de son téléphone. */
async function guestLang(): Promise<"fr" | "en"> {
  const stored = (await cookies()).get("elypse-lang")?.value;
  if (stored === "fr" || stored === "en") return stored;
  const accept = (await headers()).get("accept-language") ?? "";
  return accept.toLowerCase().startsWith("fr") || !accept ? "fr" : "en";
}

function Unavailable() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-night px-6 text-center text-ivory">
      <div className="grain absolute inset-0" />
      <Image src="/brand/monogram.png" alt="Elypse Home" width={513} height={638} className="relative h-auto w-16" priority />
      <h1 className="relative mt-8 font-serif text-3xl">Livret indisponible</h1>
      <p className="relative mt-2 max-w-xs text-sm text-ivory/60">
        Ce lien n&apos;est plus actif. Contactez votre hôte pour obtenir le nouveau lien.
      </p>
      <div className="gold-hairline relative my-6 h-px w-16" />
      <p className="relative font-serif text-xl italic text-ivory/80">Guidebook unavailable</p>
      <p className="relative mt-1 max-w-xs text-sm text-ivory/50">
        This link is no longer active. Please contact your host for the new link.
      </p>
    </main>
  );
}
