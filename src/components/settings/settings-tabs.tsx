"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePreferences } from "@/components/providers/preferences-provider";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings", fr: "Général", en: "General" },
  { href: "/settings/profile", fr: "Profil", en: "Profile" },
  { href: "/settings/location", fr: "Recherche et trajets", en: "Search & travel" },
  { href: "/settings/security", fr: "Sécurité", en: "Security" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  const { t } = usePreferences();
  return (
    <nav aria-label={t("Sections des réglages", "Settings sections")} className="mb-6 flex flex-wrap gap-1 border-b border-line">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined}
          className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", active ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink")}>
          {t(tab.fr, tab.en)}
        </Link>;
      })}
    </nav>
  );
}
