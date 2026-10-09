import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoFull } from "@/components/brand/logo";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-night px-4 py-12 text-ivory">
      <div className="grain pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(201,164,92,.35), transparent 65%)" }}
      />

      <div className="relative w-full max-w-sm animate-rise">
        <div className="mb-10 flex justify-center">
          <LogoFull priority className="w-40 drop-shadow-[0_10px_40px_rgba(201,164,92,.25)]" />
        </div>

        <div className="rounded-3xl border border-gold/20 bg-white/[0.03] p-7 shadow-2xl backdrop-blur-xl">
          <p className="text-center font-serif text-[1.65rem] leading-tight text-ivory">Espace gestion</p>
          <p className="mt-1 text-center text-xs tracking-[0.25em] text-gold/80 uppercase">Livrets d&apos;accueil</p>
          <div className="gold-hairline mx-auto my-6 h-px w-24" />
          <LoginForm />
        </div>

        <p className="mt-8 text-center text-[11px] tracking-[0.3em] text-ivory/30 uppercase">
          Elypse Home · Paris
        </p>
      </div>
    </main>
  );
}
