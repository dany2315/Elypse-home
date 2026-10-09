import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LivretEditor } from "@/components/dashboard/livret-editor";
import { getBaseUrl, livretPath } from "@/lib/base-url";
import { prisma } from "@/lib/db";
import {
  toContactItem,
  toEquipmentItem,
  toLivretForm,
  toRecoItem,
  toTransportItem,
} from "@/lib/livret-data";

const order = { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] };

async function load(id: string) {
  return prisma.livret.findUnique({
    where: { id },
    include: { recommendations: order, equipments: order, transports: order, contacts: order },
  });
}

export async function generateMetadata(props: PageProps<"/dashboard/livrets/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const l = await prisma.livret.findUnique({ where: { id }, select: { name: true } });
  return { title: l?.name ?? "Livret" };
}

export default async function LivretPage(props: PageProps<"/dashboard/livrets/[id]">) {
  const { id } = await props.params;
  const { tab } = await props.searchParams;
  const [livret, baseUrl] = await Promise.all([load(id), getBaseUrl()]);
  if (!livret) notFound();

  return (
    <LivretEditor
      key={livret.id}
      id={livret.id}
      url={`${baseUrl}${livretPath(livret.token)}`}
      initialTab={typeof tab === "string" ? tab : "general"}
      initial={toLivretForm(livret)}
      recommendations={livret.recommendations.map(toRecoItem)}
      equipments={livret.equipments.map(toEquipmentItem)}
      transports={livret.transports.map(toTransportItem)}
      contacts={livret.contacts.map(toContactItem)}
    />
  );
}
