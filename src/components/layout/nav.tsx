"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, BriefcaseBusiness, Clock3, LayoutDashboard, Menu, Search, Settings, Upload, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Brand } from "@/components/brand";
import { AppHeader } from "@/components/layout/app-header";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/providers/preferences-provider";

const ITEMS = [
  { href: "/dashboard", fr: "Tableau de bord", en: "Dashboard", icon: LayoutDashboard },
  { href: "/staff", fr: "Annuaire du staff", en: "Staff directory", icon: Users, exclude: ["/staff/import"] },
  { href: "/find-staff", fr: "Trouver du staff", en: "Find staff", icon: Search },
  { href: "/missions", fr: "Missions", en: "Missions", icon: BriefcaseBusiness },
  { href: "/hours", fr: "Heures de travail", en: "Working hours", icon: Clock3 },
  { href: "/staff/import", fr: "Importer du staff", en: "Import staff", icon: Upload },
  { href: "/activity", fr: "Activité", en: "Activity", icon: Activity },
  { href: "/notifications", fr: "Notifications", en: "Notifications", icon: Bell },
  { href: "/settings/documents", fr: "Documents obligatoires", en: "Mandatory documents", icon: Settings },
] as const;

function isActive(pathname: string, item: (typeof ITEMS)[number]) {
  const excluded = "exclude" in item ? item.exclude.some((e) => pathname.startsWith(e)) : false;
  return !excluded && (pathname === item.href || pathname.startsWith(`${item.href}/`));
}

/** Libellés visibles : toujours sur mobile/xl, au survol sur le rail réduit (lg). */
const label = "min-w-0 flex-1 truncate whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 max-lg:opacity-100";
/** Bloc texte de la marque / du compte : invisible tant que la sidebar n’est pas survolée (seule l’icône reste). */
const railText = "max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity] duration-200 group-hover/rail:max-w-52 group-hover/rail:opacity-100 group-focus-within/rail:max-w-52 group-focus-within/rail:opacity-100 max-lg:max-w-52 max-lg:opacity-100";

/** Bouton « Mon compte » en bas de la sidebar : initiales + nom (le nom n’apparaît qu’au survol). */
function AccountLink({ name, company, email, photoUrl, onNavigate }: { name: string; company: string | null; email?: string | null; photoUrl?: string | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = usePreferences();
  const active = pathname.startsWith("/settings/profile");
  return (
    <div className="shrink-0 border-t border-line p-3">
      <Link href="/settings/profile" onClick={onNavigate} title={t("Mon compte", "My account")} aria-current={active ? "page" : undefined}
        className={cn("flex h-16 items-center gap-3 rounded-xl px-[0.375rem] hover:bg-primary-soft/60", active && "bg-primary-soft")}>
        <Avatar name={name || "M"} photoUrl={photoUrl} size={44} />
        <span className={cn("min-w-0 leading-tight", railText)}>
          <span className="block truncate text-base font-semibold">{name || "Manager"}</span>
          <span className="block truncate text-sm text-muted">{company || email || t("Mon compte", "My account")}</span>
        </span>
      </Link>
    </div>
  );
}

function NavList({ unread, onNavigate }: { unread: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = usePreferences();
  return (
    <nav aria-label={t("Navigation principale", "Main navigation")} className="flex-1 space-y-1 overflow-y-auto px-3 pb-4 pt-10 scroll-thin">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        const text = t(item.fr, item.en);
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} title={text}
            className={cn("group relative flex h-14 items-center gap-4 rounded-xl px-3 text-[17px] font-medium", active ? "bg-primary-soft text-primary" : "text-muted hover:bg-primary-soft/60 hover:text-ink")}>
            {active ? <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary" /> : null}
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className={label}>{text}</span>
            {item.href === "/notifications" && unread > 0 ? (
              <span className="absolute right-2 top-2 min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white group-hover/rail:static group-focus-within/rail:static max-lg:static" aria-label={t(`${unread} non lues`, `${unread} unread`)}>{unread > 99 ? "99+" : unread}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ name, company, email, unread, photoUrl, children }: { name: string; company: string | null; email?: string | null; unread: number; photoUrl?: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = usePreferences();
  const [openFor, setOpenFor] = React.useState<string | null>(null);
  const open = openFor === pathname;
  const setOpen = (v: boolean) => setOpenFor(v ? pathname : null);
  return (
    <div className="min-h-dvh">
      <aside className="group/rail fixed left-0 top-0 z-50 hidden h-dvh w-[4.75rem] flex-col overflow-hidden border-r border-line bg-surface transition-[width,box-shadow] duration-300 ease-out hover:w-80 hover:shadow-[var(--shadow-pop)] focus-within:w-80 lg:flex">
        <div className="flex h-[var(--app-header-h)] shrink-0 items-center border-b border-line pl-4"><Brand href="/dashboard" size={44} textClassName={railText} /></div>
        <NavList unread={unread} />
        <AccountLink name={name} company={company} email={email} photoUrl={photoUrl} />
      </aside>

      <div className="lg:ml-[4.75rem]">
        <AppHeader name={name} company={company} email={email} unread={unread} photoUrl={photoUrl}
          left={<button type="button" onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-primary-soft lg:hidden" aria-label={t("Ouvrir le menu", "Open menu")} aria-expanded={open} aria-controls="mobile-nav"><Menu className="h-5 w-5" aria-hidden /></button>} />
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="anim-fade absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label={t("Fermer le menu", "Close menu")} />
          <div id="mobile-nav" className="anim-rise absolute inset-y-0 left-0 flex w-80 max-w-[88vw] flex-col border-r border-line bg-surface shadow-[var(--shadow-pop)]">
            <div className="flex h-[68px] items-center justify-between border-b border-line px-4"><Brand href="/dashboard" /><button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-primary-soft" aria-label={t("Fermer le menu", "Close menu")}><X className="h-5 w-5" aria-hidden /></button></div>
            <NavList unread={unread} onNavigate={() => setOpen(false)} />
            <AccountLink name={name} company={company} email={email} photoUrl={photoUrl} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}

      <main className="page-main min-w-0 pb-10">{children}</main>
      </div>
    </div>
  );
}
