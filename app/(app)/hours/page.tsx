import * as React from "react";
import { Clock3 } from "lucide-react";
import { HoursTable, type HoursRow } from "@/components/hours/hours-table";
import { MonthFilter } from "@/components/hours/month-filter";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { hoursSummary } from "@/lib/compliance";
import { currentMonth, monthRange } from "@/lib/hours";
import { getT } from "@/lib/i18n-server";
import { sanitizeSearchTerm } from "@/lib/utils";

export async function generateMetadata() { const { t } = await getT(); return { title: t("Heures de travail", "Working hours") }; }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function HoursPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const [{ supabase }, { t }] = await Promise.all([requireSession(), getT()]);
  const month = monthRange(one(sp.month)) ? one(sp.month) : currentMonth();
  const range = monthRange(month)!;
  const q = sanitizeSearchTerm(one(sp.q));

  const summary = await hoursSummary(supabase, range.from, range.to);
  const ids = [...summary.keys()].slice(0, 1000);

  let staffQ = supabase.from("staff").select("id, full_name, staff_code, weekly_hours").is("archived_at", null).order("full_name", { ascending: true }).limit(1000);
  if (q) staffQ = staffQ.ilike("full_name", `%${q}%`);
  else if (ids.length) staffQ = staffQ.in("id", ids);
  const { data: staff } = ids.length || q ? await staffQ : { data: [] };

  // Paie du mois : heures (travaillées, sinon prévues) × tarif horaire, pour les affectations terminées.
  type A = { staff_id: string; assignment_status: string; hours_worked: number | null; pay_rate: number | null; shift_start_at: string | null; missions: { planned_hours: number | null; pay_rate: number | null; scheduled_start_at: string | null; pay_currency: string } | { planned_hours: number | null; pay_rate: number | null; scheduled_start_at: string | null; pay_currency: string }[] | null };
  const { data: assigns } = ids.length ? await supabase.from("mission_staff").select("staff_id, assignment_status, hours_worked, pay_rate, shift_start_at, missions(planned_hours, pay_rate, scheduled_start_at, pay_currency)").in("staff_id", ids).eq("assignment_status", "completed").limit(5000) : { data: [] };
  const pay = new Map<string, number>();
  for (const a of (assigns ?? []) as unknown as A[]) {
    const m = Array.isArray(a.missions) ? a.missions[0] : a.missions;
    const when = a.shift_start_at ?? m?.scheduled_start_at;
    if (!when || when.slice(0, 7) !== month) continue;
    const h = a.hours_worked ?? m?.planned_hours ?? 0, r = a.pay_rate ?? m?.pay_rate ?? 0;
    pay.set(a.staff_id, (pay.get(a.staff_id) ?? 0) + h * r);
  }

  const rows: HoursRow[] = ((staff ?? []) as { id: string; full_name: string; staff_code: string | null; weekly_hours: number | null }[]).map((s) => {
    const u = summary.get(s.id);
    return { id: s.id, name: s.full_name, code: s.staff_code, weeklyHours: s.weekly_hours, missions: u?.missions ?? 0, completed: u?.completed ?? 0, worked: u?.worked ?? 0, reserved: u?.reserved ?? 0, pay: Math.round((pay.get(s.id) ?? 0) * 100) / 100 };
  });

  return (
    <>
      <PageHeader title={t("Heures de travail", "Working hours")} description={t("Heures travaillées et planifiées par staff, filtrées par mois.", "Hours worked and planned per staff member, filtered by month.")} actions={<MonthFilter month={month} />} />
      {rows.length === 0 ? (
        <EmptyState icon={<Clock3 className="h-8 w-8" aria-hidden />} title={t("Aucune heure ce mois-ci", "No hours this month")} description={t("Les heures apparaissent dès qu’un staff est attribué à une mission datée, ou que des heures travaillées sont saisies.", "Hours appear as soon as a staff member is assigned to a dated assignment or hours worked are entered.")} />
      ) : <HoursTable rows={rows} month={month} />}
    </>
  );
}
