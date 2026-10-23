"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, Briefcase, LayoutDashboard, LogOut, Menu, Search, Settings, Upload, Users, X } from "lucide-react";
import { logout } from "@/actions/auth";
import { Brand } from "@/components/brand";
import { cn, initials } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/staff", label: "Annuaire du staff", icon: Users, exclude: ["/staff/import"] },
  { href: "/find-staff", label: "Trouver du staff", icon: Search },
  { href: "/missions", label: "Missions", icon: Briefcase },
  { href: "/staff/import", label: "Importer du staff", icon: Upload },
  { href: "/activity", label: "Activité", icon: Activity },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Réglages", icon: Settings },
] as const;

function isActive(pathname: string, item: (typeof ITEMS)[number]) {
  const excluded = "exclude" in item ? item.exclude.some((e) => pathname.startsWith(e)) : false;
  return !excluded && (pathname === item.href || pathname.startsWith(`${item.href}/`));
}

function NavList({ unread, onNavigate }: { unread: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex-1 space-y-1 px-3">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", active ? "bg-primary-soft text-primary" : "text-ink/80 hover:bg-bg")}
          >
            <Icon className="h-4.5 w-4.5" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {item.href === "/notifications" && unread > 0 ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${unread} non lues`}>{unread > 99 ? "99+" : unread}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function Account({ name, company }: { name: string; company: string | null }) {
  return (
    <div className="border-t border-line p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary" aria-hidden>{initials(name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name || "Manager"}</p>
          {company ? <p className="truncate text-xs text-muted">{company}</p> : null}
        </div>
      </div>
      <form action={logout}>
        <button type="submit" className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink/80 hover:bg-bg">
          <LogOut className="h-4.5 w-4.5" aria-hidden /> Se déconnecter
        </button>
      </form>
    </div>
  );
}

export function AppShell({ name, company, unread, children }: { name: string; company: string | null; unread: number; children: React.ReactNode }) {
  const pathname = usePathname();
  // Le menu mobile est « ouvert pour un chemin donné » : il se referme tout seul quand la page change.
  const [openFor, setOpenFor] = React.useState<string | null>(null);
  const open = openFor === pathname;
  const setOpen = (v: boolean) => setOpenFor(v ? pathname : null);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 py-5"><Brand href="/dashboard" /></div>
        <NavList unread={unread} />
        <Account name={name} company={company} />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Brand href="/dashboard" />
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-bg" aria-label="Ouvrir le menu" aria-expanded={open} aria-controls="mobile-nav">
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-label="Fermer le menu" />
          <div id="mobile-nav" className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl">
            <div className="flex items-center justify-between px-5 py-4">
              <Brand href="/dashboard" />
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-bg" aria-label="Fermer le menu"><X className="h-5 w-5" aria-hidden /></button>
            </div>
            <NavList unread={unread} onNavigate={() => setOpen(false)} />
            <Account name={name} company={company} />
          </div>
        </div>
      ) : null}

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
