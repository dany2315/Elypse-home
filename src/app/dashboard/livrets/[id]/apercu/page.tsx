import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LivretLinkButton } from "@/components/dashboard/livret-link";
import { Button } from "@/components/ui/button";
import { getBaseUrl, livretPath } from "@/lib/base-url";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Aperçu" };

export default async function ApercuPage(props: PageProps<"/dashboard/livrets/[id]/apercu">) {
  const { id } = await props.params;
  const livret = await prisma.livret.findUnique({ where: { id }, select: { id: true, name: true, title: true, token: true, active: true } });
  if (!livret) notFound();
  const path = livretPath(livret.token);
  const url = `${await getBaseUrl()}${path}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/dashboard/livrets/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-ink"
          >
            <ArrowLeft className="size-3.5" /> Retour à l&apos;édition
          </Link>
          <h1 className="mt-1 truncate font-serif text-3xl text-ink">Aperçu — {livret.name}</h1>
          {!livret.active && (
            <p className="mt-1 text-xs text-amber-700">
              Ce livret est inactif : seul un administrateur connecté peut le voir.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink /> Ouvrir
            </a>
          </Button>
          <LivretLinkButton livretId={livret.id} url={url} name={livret.name} />
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <div className="relative rounded-[3.2rem] bg-night p-3 shadow-[0_50px_100px_-30px_rgba(7,12,28,.55)] ring-1 ring-gold/30">
          <div className="absolute top-3 left-1/2 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-night" />
          <iframe
            src={path}
            title={`Aperçu du livret ${livret.title}`}
            className="h-[min(812px,calc(100dvh-12rem))] w-[375px] max-w-[calc(100vw-3rem)] rounded-[2.5rem] bg-ivory"
          />
        </div>
      </div>
    </main>
  );
}
