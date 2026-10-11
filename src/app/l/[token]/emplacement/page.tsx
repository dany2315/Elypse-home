import type { Metadata } from "next";
import { cache } from "react";
import { LocationPage } from "@/components/livret/location-page";
import { Unavailable } from "@/components/livret/unavailable";
import { getSession } from "@/lib/auth";
import { livretPath } from "@/lib/base-url";
import { prisma } from "@/lib/db";

const getLivret = cache((token: string) =>
  prisma.livret.findUnique({
    where: { token },
    select: {
      title: true,
      active: true,
      coverImageId: true,
      facadeImageIds: true,
      locationImageIds: true,
    },
  }),
);

export async function generateMetadata(props: PageProps<"/l/[token]/emplacement">): Promise<Metadata> {
  const { token } = await props.params;
  const livret = await getLivret(token);
  return {
    title: livret ? { absolute: `${livret.title} — Emplacement` } : "Livret indisponible",
    robots: { index: false, follow: false },
  };
}

export default async function EmplacementPage(props: PageProps<"/l/[token]/emplacement">) {
  const { token } = await props.params;
  const livret = await getLivret(token);

  // Comme le livret : un logement inactif reste visible pour l'administrateur connecté.
  const visible = livret && (livret.active || (await getSession()));
  if (!livret || !visible) return <Unavailable />;

  // Photos de l'emplacement, à défaut celles de la devanture, à défaut la couverture.
  const photos = livret.locationImageIds.length
    ? livret.locationImageIds
    : livret.facadeImageIds.length
      ? livret.facadeImageIds
      : livret.coverImageId
        ? [livret.coverImageId]
        : [];

  return <LocationPage title={livret.title} photoIds={photos} livretHref={livretPath(token)} />;
}
