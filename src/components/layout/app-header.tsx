"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BriefcaseBusiness, FileCheck2, Globe2, LogOut, Moon, Plus, Search, ShieldCheck, Sun, UserPlus, UserRound } from "lucide-react";
import { logout } from "@/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { usePreferences } from "@/components/providers/preferences-provider";
import { APP_CONFIG } from "@/config/app";
import { cn } from "@/lib/utils";

const iconBtn = "grid h-9 w-9 place-items-center rounded-lg border border-transparent text-muted transition-colors hover:border-line hover:bg-primary-soft/70 hover:text-ink focus-visible:outline-offset-2";

/** Recherche rapide d’un staff (nom, code, ville…) depuis n’importe quelle page + création rapide. */
function QuickActions() {
  const router = useRouter();
  const { t } = usePreferences();
  const [q, setQ] = React.useState("");
  return (
    <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
      <form role="search" className="relative w-full max-w-md" onSubmit={(e) => { e.preventDefault(); const v = q.trim(); router.push(v ? `/staff?q=${encodeURIComponent(v)}` : "/staff"); setQ(""); }}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search" aria-label={t("Rechercher un staff", "Search staff")} placeholder={t("Rechercher un staff : nom, code, ville…", "Search staff: name, ID, city…")}
          className="h-9 w-full rounded-lg border border-line bg-surface-2/60 pl-9 pr-3 text-sm placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary/10" />
      </form>
      <DropdownMenu size="sm" variant="secondary" align="left" icon={<Plus className="h-4 w-4" aria-hidden />} label={t("Nouveau", "New")}
        items={[
          { label: t("Ajouter un staff", "Add staff"), icon: <UserPlus className="h-4 w-4" aria-hidden />, onSelect: () => router.push("/staff/new") },
          { label: t("Nouvelle mission", "New mission"), icon: <BriefcaseBusiness className="h-4 w-4" aria-hidden />, onSelect: () => router.push("/missions/new") },
        ]} />
    </div>
  );
}

/** En-tête de l’application : langue, thème, notifications et menu du profil (déconnexion incluse). */
export function AppHeader({ name, company, email, unread, photoUrl, left }: { name: string; company: string | null; email?: string | null; unread: number; photoUrl?: string | null; left?: React.ReactNode }) {
  const { t, locale, setLocale, theme, setTheme } = usePreferences();
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", out); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", out); document.removeEventListener("keydown", key); };
  }, [open]);

  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-primary-soft";
  return (
    <header className="glass sticky top-0 z-40 flex h-[var(--app-header-h)] items-center gap-2 border-b border-line px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">{left}<QuickActions /></div>

      <div className="flex items-center gap-1">
        <div className="hidden items-center rounded-lg border border-line p-0.5 sm:flex" role="group" aria-label={t("Langue", "Language")}>
          {(["fr", "en"] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLocale(l)} aria-pressed={locale === l} title={l === "fr" ? "Français" : "English"}
              className={cn("h-7 rounded-md px-2 text-[11px] font-bold uppercase tracking-wide transition-colors", locale === l ? "bg-primary text-white" : "text-muted hover:text-ink")}>{l}</button>
          ))}
        </div>
        <button type="button" className={cn(iconBtn, "hidden sm:grid")} onClick={() => setTheme(theme === "light" ? "dark" : "light")} title={theme === "light" ? t("Mode sombre", "Dark mode") : t("Mode clair", "Light mode")} aria-label={t("Changer de thème", "Toggle theme")}>
          {theme === "light" ? <Moon className="h-[18px] w-[18px]" aria-hidden /> : <Sun className="h-[18px] w-[18px]" aria-hidden />}
        </button>
        <Link href="/notifications" className={cn(iconBtn, "relative")} title="Notifications" aria-label={unread > 0 ? t(`Notifications (${unread} non lues)`, `Notifications (${unread} unread)`) : "Notifications"}>
          <Bell className="h-[18px] w-[18px]" aria-hidden />
          {unread > 0 ? <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-4 text-white">{unread > 99 ? "99+" : unread}</span> : null}
        </Link>

        <div ref={root} className="relative ml-1">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="grid place-items-center rounded-full ring-offset-2 ring-offset-surface transition hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary" title={name || t("Mon compte", "My account")} aria-label={t("Mon compte", "My account")}>
            <Avatar name={name || "M"} photoUrl={photoUrl} size={34} />
          </button>
          {open ? (
            <div role="menu" className="anim-pop absolute right-0 z-50 mt-2 w-72 rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]">
              <div className="px-3 py-2">
                <p className="truncate text-sm font-semibold">{name || "Manager"}</p>
                <p className="truncate text-xs text-muted">{company || email || ""}</p>
              </div>
              <div className="my-1 h-px bg-line" />
              <Link role="menuitem" href="/settings/profile" onClick={() => setOpen(false)} className={item}><UserRound className="h-4 w-4" aria-hidden />{t("Profil et préférences", "Profile and preferences")}</Link>
              <Link role="menuitem" href="/settings/documents" onClick={() => setOpen(false)} className={item}><FileCheck2 className="h-4 w-4" aria-hidden />{t("Documents obligatoires", "Mandatory documents")}</Link>
              <Link role="menuitem" href="/privacy" onClick={() => setOpen(false)} className={item}><ShieldCheck className="h-4 w-4" aria-hidden />{t("Confidentialité", "Privacy")}</Link>
              <div className="sm:hidden">
                <div className="my-1 h-px bg-line" />
                <button role="menuitem" type="button" className={item} onClick={() => setLocale(locale === "fr" ? "en" : "fr")}><Globe2 className="h-4 w-4" aria-hidden />{locale === "fr" ? "English" : "Français"}</button>
                <button role="menuitem" type="button" className={item} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? <Moon className="h-4 w-4" aria-hidden /> : <Sun className="h-4 w-4" aria-hidden />}{theme === "light" ? t("Mode sombre", "Dark mode") : t("Mode clair", "Light mode")}</button>
              </div>
              <div className="my-1 h-px bg-line" />
              <form action={logout}><button role="menuitem" type="submit" className={cn(item, "text-danger hover:!bg-danger-soft")}><LogOut className="h-4 w-4" aria-hidden />{t("Se déconnecter", "Sign out")}</button></form>
              <p className="px-3 pb-1 pt-2 text-[11px] text-muted">{APP_CONFIG.name} · v{APP_CONFIG.version}</p>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
