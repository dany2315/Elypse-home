"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
      rememberMe: true,
    });
    if (error) {
      setPending(false);
      setError("Email ou mot de passe incorrect.");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  const field =
    "h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-[15px] text-ivory placeholder:text-ivory/30 outline-none transition focus:border-gold/60 focus:bg-white/[0.06] focus:ring-4 focus:ring-gold/10";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-[11px] font-medium tracking-[0.2em] text-ivory/50 uppercase">Email</span>
        <input name="email" type="email" autoComplete="email" required className={field} placeholder="vous@exemple.com" />
      </label>

      <label className="block space-y-2">
        <span className="text-[11px] font-medium tracking-[0.2em] text-ivory/50 uppercase">Mot de passe</span>
        <span className="relative block">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${field} pr-12`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ivory/40 transition hover:text-gold"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-gold-foil mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold tracking-[0.15em] text-night uppercase shadow-[0_10px_30px_-10px_rgba(201,164,92,.6)] transition hover:brightness-110 disabled:opacity-70"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        Se connecter
      </button>
    </form>
  );
}
