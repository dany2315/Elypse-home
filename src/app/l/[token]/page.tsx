import type { Metadata } from "next";
import { cache } from "react";
import { GuestLivret } from "@/components/livret/guest-livret";
import { Unavailable } from "@/components/livret/unavailable";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { guestLang } from "@/lib/guest-lang";
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
