import Image from "next/image";

/** Écran affiché quand un lien voyageur est inconnu ou que le livret est désactivé. */
export function Unavailable() {
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
