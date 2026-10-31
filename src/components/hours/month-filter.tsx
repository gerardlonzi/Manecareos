"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePreferences } from "@/components/providers/preferences-provider";

const shift = (ym: string, delta: number) => { const [y = 1970, m = 1] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + delta, 1)); return d.toISOString().slice(0, 7); };

/** Filtre par mois (AAAA-MM) dans l'URL : précédent / suivant / sélecteur natif. */
export function MonthFilter({ month }: { month: string }) {
  const router = useRouter(); const path = usePathname(); const sp = useSearchParams(); const { t } = usePreferences();
  const go = (ym: string) => { const p = new URLSearchParams(sp.toString()); p.set("month", ym); p.delete("page"); router.push(`${path}?${p.toString()}`, { scroll: false }); };
  const btn = "grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-primary-soft";
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={t("Filtrer par mois", "Filter by month")}>
      <button type="button" className={btn} onClick={() => go(shift(month, -1))} aria-label={t("Mois précédent", "Previous month")}><ChevronLeft className="h-4 w-4" aria-hidden /></button>
      <input type="month" value={month} onChange={(e) => e.target.value && go(e.target.value)} aria-label={t("Mois", "Month")} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" />
      <button type="button" className={btn} onClick={() => go(shift(month, 1))} aria-label={t("Mois suivant", "Next month")}><ChevronRight className="h-4 w-4" aria-hidden /></button>
    </div>
  );
}
