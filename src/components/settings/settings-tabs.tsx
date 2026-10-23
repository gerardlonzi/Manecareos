"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings", label: "Général" },
  { href: "/settings/profile", label: "Profil" },
  { href: "/settings/location", label: "Recherche et trajets" },
  { href: "/settings/security", label: "Sécurité" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections des réglages" className="mb-6 flex flex-wrap gap-1 border-b border-line">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", active ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
