"use client";
import { MapPinOff } from "lucide-react";
import { usePreferences } from "@/components/providers/preferences-provider";
export function MapNotice({ className = "" }: { className?: string }) {
  const { t } = usePreferences();
  return <div className={`grid place-items-center rounded-xl border border-dashed border-line bg-bg p-6 text-center ${className}`}><div className="max-w-sm"><MapPinOff className="mx-auto mb-2 h-6 w-6 text-muted" aria-hidden /><p className="text-sm font-medium">{t("Carte indisponible", "Map unavailable")}</p><p className="mt-1 text-xs text-muted">{t("La carte interactive n’est pas disponible pour le moment. Vous pouvez continuer à utiliser les résultats et les informations de distance disponibles.", "The interactive map is temporarily unavailable. You can still use results and any available distance information.")}</p></div></div>;
}
