"use client";
import Link from "next/link";
import { Download } from "lucide-react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { toCsv } from "@/lib/csv/export";
import { downloadCsv } from "@/lib/download";

export type HoursRow = { id: string; name: string; code: string | null; weeklyHours: number | null; missions: number; completed: number; worked: number; reserved: number; pay: number };
const th = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted whitespace-nowrap";
const r2 = (n: number) => Math.round(n * 100) / 100;

export function HoursTable({ rows, month }: { rows: HoursRow[]; month: string }) {
  const { t } = usePreferences();
  const total = rows.reduce((a, r) => ({ worked: a.worked + r.worked, reserved: a.reserved + r.reserved, pay: a.pay + r.pay, missions: a.missions + r.missions }), { worked: 0, reserved: 0, pay: 0, missions: 0 });
  const exportCsv = () => downloadCsv(`heures-${month}.csv`, toCsv(
    ["staff", "code", "month", "missions", "completed", "hours_worked", "hours_planned", "total_hours", "weekly_hours", "pay_completed_GBP"],
    rows.map((r) => [r.name, r.code, month, r.missions, r.completed, r2(r.worked), r2(r.reserved), r2(r.worked + r.reserved), r.weeklyHours, r.pay]), { bom: true }));
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([[t("Staff concernés", "Staff involved"), rows.length], [t("Missions", "Assignments"), total.missions], [t("Heures travaillées", "Hours worked"), `${r2(total.worked)} h`], [t("Heures planifiées", "Hours planned"), `${r2(total.reserved)} h`]] as [string, string | number][]).map(([l, v]) => (
          <div key={l} className="rounded-xl border border-line bg-surface p-3"><dt className="text-xs text-muted">{l}</dt><dd className="text-xl font-semibold">{v}</dd></div>
        ))}
      </dl>
      <div className="flex justify-end"><Button variant="secondary" size="sm" onClick={exportCsv}><Download className="h-4 w-4" aria-hidden />{t("Exporter le mois (CSV)", "Export month (CSV)")}</Button></div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-surface-2"><tr><th className={th}>{t("Staff", "Staff")}</th><th className={`${th} text-right`}>{t("Missions", "Assignments")}</th><th className={`${th} text-right`}>{t("Terminées", "Completed")}</th><th className={`${th} text-right`}>{t("Travaillées", "Worked")}</th><th className={`${th} text-right`}>{t("Planifiées", "Planned")}</th><th className={`${th} text-right`}>{t("Total", "Total")}</th><th className={`${th} text-right`}>{t("Paie (terminées)", "Pay (completed)")}</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2"><Link href={`/staff/${r.id}?month=${month}`} className="font-medium hover:text-primary hover:underline">{r.name}</Link>{r.code ? <span className="ml-2 font-mono text-[11px] text-muted">{r.code}</span> : null}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.missions}</td><td className="px-3 py-2 text-right tabular-nums">{r.completed}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r2(r.worked)} h</td><td className="px-3 py-2 text-right tabular-nums">{r2(r.reserved)} h</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{r2(r.worked + r.reserved)} h</td><td className="px-3 py-2 text-right tabular-nums">{r.pay ? r2(r.pay) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
