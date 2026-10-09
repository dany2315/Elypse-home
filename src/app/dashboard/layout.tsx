import Link from "next/link";
import { Monogram } from "@/components/brand/logo";
import { UserMenu } from "@/components/dashboard/user-menu";
import { requireSession } from "@/lib/auth";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const session = await requireSession();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-night/95 text-ivory backdrop-blur supports-[backdrop-filter]:bg-night/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Monogram className="w-7" priority />
            <span className="leading-none">
              <span className="block font-serif text-lg tracking-wide text-ivory">Elypse Home</span>
              <span className="block text-[10px] tracking-[0.3em] text-gold/80 uppercase">Livrets d&apos;accueil</span>
            </span>
          </Link>
          <UserMenu email={session.user.email} />
        </div>
        <div className="gold-hairline h-px opacity-40" />
      </header>
      {children}
    </div>
  );
}
