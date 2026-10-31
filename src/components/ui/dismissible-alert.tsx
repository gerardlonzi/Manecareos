"use client";
import * as React from "react";
import { X } from "lucide-react";
import { Alert } from "@/components/ui/card";
import { usePreferences } from "@/components/providers/preferences-provider";

/**
 * Bandeau d'alerte que l'utilisateur peut fermer avec une croix.
 * Le choix est mémorisé dans ce navigateur ; le bandeau réapparaît si `version` change (ex. le nombre d'éléments en attente).
 */
export function DismissibleAlert({ id, version = "", tone, title, children }: { id: string; version?: string | number; tone?: "info" | "warning" | "danger" | "success"; title?: React.ReactNode; children?: React.ReactNode }) {
  const { t } = usePreferences();
  const key = `mc-dismissed:${id}`;
  const [hidden, setHidden] = React.useState(false);
  React.useEffect(() => {
    try { setHidden(window.localStorage.getItem(key) === String(version)); } catch { /* stockage indisponible : on affiche */ }
  }, [key, version]);
  if (hidden) return null;
  return (
    <div className="relative">
      <Alert tone={tone} title={title} className="pr-11">{children}</Alert>
      <button type="button" aria-label={t("Fermer cette alerte", "Dismiss this alert")} title={t("Fermer", "Dismiss")}
        onClick={() => { setHidden(true); try { window.localStorage.setItem(key, String(version)); } catch { /* ignoré */ } }}
        className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-md text-current opacity-70 transition hover:bg-black/10 hover:opacity-100 focus-visible:outline-offset-2">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}