"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { setWeeklyHours } from "@/actions/staff";
import { usePreferences } from "@/components/providers/preferences-provider";
import { cn } from "@/lib/utils";

/** Heures de la semaine : « 12 / 20 h · il reste 8 h », avec modification du plafond en ligne. */
export function HoursEditor({ staffId, cap, used, compact, onSaved, disabled }: { staffId: string; cap: number | null; used: number; compact?: boolean; onSaved?: (v: number | null) => void; disabled?: boolean }) {
  const router = useRouter();
  const { t, tm } = usePreferences();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(cap != null ? String(cap) : "");
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);
  const remaining = cap != null ? Math.round((cap - used) * 100) / 100 : null;
  const over = remaining != null && remaining < 0, atCap = remaining != null && remaining === 0;
  const save = () => start(async () => {
    const r = await setWeeklyHours(staffId, value);
    if (!r.ok) { setErr(tm(r.error)); return; }
    setErr(null); setEditing(false); onSaved?.(r.data?.weekly_hours ?? null); toast.success(tm(r.message ?? "Enregistré")); router.refresh();
  });

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input autoFocus inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          aria-label={t("Heures par semaine", "Hours per week")} aria-invalid={!!err} placeholder="37.5" className="h-8 w-20 rounded-md border border-line bg-surface px-2 text-right text-sm" />
        <button type="button" onClick={save} disabled={pending} className="grid h-7 w-7 place-items-center rounded-md text-success hover:bg-success-soft" aria-label={t("Valider", "Confirm")}><Check className="h-4 w-4" aria-hidden /></button>
        <button type="button" onClick={() => { setEditing(false); setErr(null); }} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-primary-soft" aria-label={t("Annuler", "Cancel")}><X className="h-4 w-4" aria-hidden /></button>
        {err ? <span role="alert" className="text-xs text-danger">{err}</span> : null}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="tabular-nums">
        {cap != null ? (
          <>
            <strong className={cn("whitespace-nowrap", over && "text-danger", atCap && "text-warning")}>{over ? t(`+${-(remaining ?? 0)} h en trop`, `${-(remaining ?? 0)} h over`) : atCap ? t("Complet", "Full") : t(`${remaining} h restantes`, `${remaining} h left`)}</strong>
            {!compact ? <span className="ml-1.5 whitespace-nowrap text-xs text-muted max-xl:ml-0 max-xl:block">({Math.round(used * 100) / 100}/{cap} h)</span> : null}
          </>
        ) : <span className="text-muted">—</span>}
      </span>
      {!disabled ? <button type="button" onClick={() => { setValue(cap != null ? String(cap) : ""); setEditing(true); }} className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-primary-soft hover:text-ink" aria-label={t("Modifier les heures", "Edit hours")} title={t("Modifier les heures par semaine", "Edit hours per week")}><Pencil className="h-3 w-3" aria-hidden /></button> : null}
    </span>
  );
}
