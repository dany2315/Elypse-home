import Image from "next/image";
import { cn } from "@/lib/utils";

/** Monogramme doré (dôme + EH) sur fond transparent. */
export function Monogram({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/monogram.png"
      alt="Elypse Home"
      width={513}
      height={638}
      priority={priority}
      className={cn("h-auto w-10 select-none", className)}
    />
  );
}

/** Logo complet (emblème + ELYPSE HOME · PARIS · LUXURY APARTMENTS). */
export function LogoFull({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/logo-full.png"
      alt="Elypse Home — Paris, Luxury Apartments"
      width={848}
      height={994}
      priority={priority}
      className={cn("h-auto w-48 select-none", className)}
    />
  );
}
