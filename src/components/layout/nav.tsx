"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, BriefcaseBusiness, Globe2, LayoutDashboard, LogOut, Menu, Moon, Search, Sun, Upload, Users, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/providers/preferences-provider";
import { logout } from "@/actions/auth";

const ITEMS = [
  { href: "/dashboard", fr: "Tableau de bord", en: "Dashboard", icon: LayoutDashboard },
  { href: "/staff", fr: "Annuaire du staff", en: "Staff directory", icon: Users, exclude: ["/staff/import"] },
  { href: "/find-staff", fr: "Trouver du staff", en: "Find staff", icon: Search },
  { href: "/missions", fr: "Missions", en: "Missions", icon: BriefcaseBusiness },
  { href: "/staff/import", fr: "Importer du staff", en: "Import staff", icon: Upload },
  { href: "/activity", fr: "Activité", en: "Activity", icon: Activity },
  { href: "/notifications", fr: "Notifications", en: "Notifications", icon: Bell },
] as const;

function isActive(pathname: string, item: (typeof ITEMS)[number]) {
  const excluded = "exclude" in item ? item.exclude.some((e) => pathname.startsWith(e)) : false;
  return !excluded && (pathname === item.href || pathname.startsWith(`${item.href}/`));
}

/** Libellés visibles : toujours sur mobile/xl, au survol sur le rail réduit (lg). */
const label = "hidden min-w-0 flex-1 truncate group-hover/rail:block xl:block max-lg:block";

function NavList({ unread, onNavigate }: { unread: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = usePreferences();
  return (
    <nav aria-label={t("Navigation principale", "Main navigation")} className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scroll-thin">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        const text = t(item.fr, item.en);
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} title={text}
            className={cn("group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium", active ? "bg-primary-soft text-primary" : "text-muted hover:bg-primary-soft/60 hover:text-ink")}>
            {active ? <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary" /> : null}
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className={label}>{text}</span>
            {item.href === "/notifications" && unread > 0 ? (
              <span className="absolute right-2 top-1.5 min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white group-hover/rail:static xl:static max-lg:static" aria-label={t(`${unread} non lues`, `${unread} unread`)}>{unread > 99 ? "99+" : unread}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function Account({ name, company, photoUrl, onNavigate }: { name: string; company: string | null; photoUrl?: string | null; onNavigate?: () => void }) {
  const { t, locale, setLocale, theme, setTheme } = usePreferences();
  const btn = "flex h-9 items-center justify-center gap-2 rounded-lg px-2 text-[11px] font-semibold text-muted hover:bg-primary-soft/60 hover:text-ink";
  return (
    <div className="border-t border-line p-3">
      <Link href="/settings/profile" onClick={onNavigate} title={t("Profil et préférences", "Profile and preferences")} className="mb-2 flex items-center gap-3 rounded-lg p-2 hover:bg-primary-soft/60">
        <Avatar name={name || "M"} photoUrl={photoUrl} size={32} />
        <span className="hidden min-w-0 flex-1 group-hover/rail:block xl:block max-lg:block">
          <span className="block truncate text-xs font-semibold">{name || "Manager"}</span>
          <span className="block truncate text-[10px] text-muted">{company || t("Mon profil", "My profile")}</span>
        </span>
      </Link>
      <div className="grid gap-1">
        <button type="button" onClick={() => setLocale(locale === "fr" ? "en" : "fr")} title={t("Changer de langue", "Change language")} className={btn}><Globe2 className="h-4 w-4" aria-hidden /><span className="hidden group-hover/rail:inline xl:inline max-lg:inline">{locale === "fr" ? "Français → English" : "English → Français"}</span></button>
        <button type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} title={t("Changer de thème", "Toggle theme")} className={btn}>{theme === "light" ? <Moon className="h-4 w-4" aria-hidden /> : <Sun className="h-4 w-4" aria-hidden />}<span className="hidden group-hover/rail:inline xl:inline max-lg:inline">{theme === "light" ? t("Mode sombre", "Dark mode") : t("Mode clair", "Light mode")}</span></button>
        <form action={logout}><button type="submit" title={t("Se déconnecter", "Sign out")} className={cn(btn, "w-full hover:!bg-danger-soft hover:!text-danger")}><LogOut className="h-4 w-4" aria-hidden /><span className="hidden group-hover/rail:inline xl:inline max-lg:inline">{t("Se déconnecter", "Sign out")}</span></button></form>
      </div>
    </div>
  );
}

export function AppShell({ name, company, unread, photoUrl, children }: { name: string; company: string | null; unread: number; photoUrl?: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = usePreferences();
  const [openFor, setOpenFor] = React.useState<string | null>(null);
  const open = openFor === pathname;
  const setOpen = (v: boolean) => setOpenFor(v ? pathname : null);
  return (
    <div className="min-h-dvh">
      <aside className="group/rail fixed left-0 top-0 z-40 hidden h-dvh w-[4.75rem] flex-col overflow-hidden border-r border-line bg-surface transition-[width,box-shadow] duration-200 hover:w-64 hover:shadow-[var(--shadow-pop)] lg:flex xl:w-64">
        <div className="flex h-[68px] shrink-0 items-center border-b border-line pl-[1.1rem]"><Brand href="/dashboard" size={36} compact={false} /></div>
        <NavList unread={unread} />
        <Account name={name} company={company} photoUrl={photoUrl} />
      </aside>

      <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur-md lg:hidden">
        <Brand href="/dashboard" />
        <button type="button" onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg border border-line hover:bg-primary-soft" aria-label={t("Ouvrir le menu", "Open menu")} aria-expanded={open} aria-controls="mobile-nav"><Menu className="h-5 w-5" aria-hidden /></button>
      </header>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="anim-fade absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label={t("Fermer le menu", "Close menu")} />
          <div id="mobile-nav" className="anim-rise absolute inset-y-0 left-0 flex w-80 max-w-[88vw] flex-col border-r border-line bg-surface shadow-[var(--shadow-pop)]">
            <div className="flex h-[68px] items-center justify-between border-b border-line px-4"><Brand href="/dashboard" /><button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-primary-soft" aria-label={t("Fermer le menu", "Close menu")}><X className="h-5 w-5" aria-hidden /></button></div>
            <NavList unread={unread} onNavigate={() => setOpen(false)} />
            <Account name={name} company={company} photoUrl={photoUrl} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}

      <main className="min-w-0 px-4 pb-10 sm:px-6 lg:ml-[4.75rem] lg:px-8 xl:ml-64">
        <div className="mx-auto w-full max-w-[1500px]">{children}</div>
      </main>
    </div>
  );
}
