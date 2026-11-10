"use client";

import { BookOpen, ChartColumn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Livrets", icon: BookOpen, match: (p: string) => !p.startsWith("/dashboard/finances") },
  { href: "/dashboard/finances", label: "Finances", icon: ChartColumn, match: (p: string) => p.startsWith("/dashboard/finances") },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1" aria-label="Sections du dashboard">
      {links.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition sm:px-4",
              active ? "bg-white/10 text-gold-light ring-1 ring-gold/30" : "text-ivory/70 hover:bg-white/5 hover:text-ivory",
            )}
          >
            <Icon className="size-4" strokeWidth={1.6} />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
