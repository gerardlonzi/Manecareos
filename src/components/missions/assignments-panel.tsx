"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeAssignment, setAssignmentStatus, updateAssignmentShift } from "@/actions/assignments";
import { ContactButtons } from "@/components/staff/contact-buttons";
import { AssignmentBadge, AvailabilityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Avatar } from "@/components/ui/avatar";
import { usePreferences } from "@/components/providers/preferences-provider";
import type { AssignmentStatus, AvailabilityStatus } from "@/lib/types";
import { hoursBetween, parseHoursInput } from "@/lib/hours";

export type AssignmentRow = {
  id: string;
  status: AssignmentStatus;
  staffId: string;
  name: string;
  phone: string | null;
  availability: AvailabilityStatus;
  archived: boolean;
  photoUrl?: string | null;
  shiftStart?: string; shiftEnd?: string; hoursWorked?: number | null; payRate?: number | null; currency?: string; plannedHours?: number | null;
};

const inputCls = "h-9 w-full rounded-lg border border-line bg-card px-2 text-sm";

/** Heures réellement travaillées : début/fin (calcul auto) ou durée directe, paie, case « terminée ». */
function ShiftEditor({ a }: { a: AssignmentRow }) {
  const router = useRouter();
  const { t, tm } = usePreferences();
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [startL, setStartL] = React.useState(a.shiftStart ?? "");
  const [endL, setEndL] = React.useState(a.shiftEnd ?? "");
  const [hours, setHours] = React.useState(a.hoursWorked != null ? String(a.hoursWorked) : "");
  const [rate, setRate] = React.useState(a.payRate != null ? String(a.payRate) : "");
  const [done, setDone] = React.useState(a.status === "completed");
  const [errs, setErrs] = React.useState<Record<string, string>>({});
  const auto = !hours.trim() && startL && endL ? hoursBetween(`${startL}:00Z`, `${endL}:00Z`) : null;
  const total = parseHoursInput(hours) ?? auto ?? a.hoursWorked ?? a.plannedHours ?? null;
  const cost = total != null && rate.trim() && Number.isFinite(Number(rate.replace(",", "."))) ? Math.round(total * Number(rate.replace(",", ".")) * 100) / 100 : null;
  const save = () => start(async () => {
    const r = await updateAssignmentShift(a.id, { shift_start_local: startL, shift_end_local: endL, hours, pay_rate: rate, completed: done });
    if (!r.ok) { setErrs(r.fieldErrors ?? {}); toast.error(tm(r.error)); return; }
    setErrs({}); toast.success(tm(r.message ?? "Enregistré")); setOpen(false); router.refresh();
  });
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 p-2.5">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between text-left text-xs font-medium text-muted hover:text-ink">
        <span>{a.hoursWorked != null ? `${a.hoursWorked} h ${t("travaillées", "worked")}${a.payRate != null ? ` · ${a.payRate} ${a.currency ?? "GBP"}/h` : ""}` : t("Saisir les heures travaillées", "Enter hours worked")}</span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-xs">{t("Début", "Start")}<input type="datetime-local" value={startL} onChange={(e) => setStartL(e.target.value)} className={inputCls} /><span className="text-danger">{errs.shift_start_local ? tm(errs.shift_start_local) : ""}</span></label>
          <label className="text-xs">{t("Fin", "End")}<input type="datetime-local" value={endL} onChange={(e) => setEndL(e.target.value)} className={inputCls} /><span className="text-danger">{errs.shift_end_local ? tm(errs.shift_end_local) : ""}</span></label>
          <label className="text-xs">{t("Heures (ou 7h30)", "Hours (or 7h30)")}<input value={hours} onChange={(e) => setHours(e.target.value)} placeholder={auto != null ? String(auto) : a.plannedHours != null ? String(a.plannedHours) : "7h30"} inputMode="decimal" className={inputCls} /><span className="text-danger">{errs.hours ? tm(errs.hours) : ""}</span></label>
          <label className="text-xs">{t("Paie horaire", "Hourly pay")} ({a.currency ?? "GBP"})<input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className={inputCls} /><span className="text-danger">{errs.pay_rate ? tm(errs.pay_rate) : ""}</span></label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />{t("Mission terminée", "Assignment completed")}</label>
          <div className="flex items-center justify-between gap-2 sm:col-span-2"><span className="text-xs text-muted">{total != null ? `${total} h${cost != null ? ` · ${cost} ${a.currency ?? "GBP"}` : ""}` : ""}</span><Button size="sm" pending={pending} onClick={save}>{t("Enregistrer", "Save")}</Button></div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ a, locked }: { a: AssignmentRow; locked: boolean }) {
  const router = useRouter();
  const { t, tm } = usePreferences();
  const [pending, start] = React.useTransition();
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  const set = (status: AssignmentStatus) =>
    start(async () => {
      const r = await setAssignmentStatus(a.id, status);
      if (!r.ok) toast.error(tm(r.error)); else toast.success(tm(r.message ?? "Statut mis à jour"));
      router.refresh();
    });

  const active = a.status === "selected" || a.status === "contacted" || a.status === "confirmed";
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Avatar name={a.name} photoUrl={a.photoUrl} size={28} /><Link href={`/staff/${a.staffId}`} className="font-medium hover:text-primary hover:underline">{a.name}</Link>
          <AssignmentBadge status={a.status} />
          <AvailabilityBadge status={a.availability} />
        </div>
        <ContactButtons phone={a.phone} />
      </div>
      {!locked && a.status !== "declined" && a.status !== "cancelled" ? <ShiftEditor a={a} /> : null}
      {!locked ? (
        <div className="flex flex-wrap gap-2">
          {a.status === "selected" ? <Button size="sm" variant="secondary" pending={pending} onClick={() => set("contacted")}>{t("Marquer comme contacté", "Mark as contacted")}</Button> : null}
          {(a.status === "selected" || a.status === "contacted") ? <Button size="sm" variant="secondary" pending={pending} onClick={() => set("confirmed")}>{t("Marquer comme confirmé", "Mark as confirmed")}</Button> : null}
          {(a.status === "selected" || a.status === "contacted" || a.status === "confirmed") ? <Button size="sm" variant="secondary" pending={pending} onClick={() => set("declined")}>{t("A refusé", "Declined")}</Button> : null}
          {a.status === "confirmed" ? <Button size="sm" variant="secondary" pending={pending} onClick={() => set("completed")}>{t("Marquer comme terminé", "Mark as completed")}</Button> : null}
          {(a.status === "declined" || a.status === "cancelled") ? <Button size="sm" variant="secondary" pending={pending} onClick={() => set("selected")}>{t("Resélectionner", "Select again")}</Button> : null}
          {active ? <Button size="sm" variant="outlineDanger" disabled={pending} onClick={() => setConfirmRemove(true)}>{t("Retirer", "Remove")}</Button> : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmRemove} destructive pending={pending} title={t("Retirer ce staff de la mission ?", "Remove this person from the assignment?")}
        description={t(`${a.name} ne sera plus sélectionné pour cette mission. L’historique est conservé.`, `${a.name} will no longer be selected for this assignment. History is kept.`)}
        confirmLabel={t("Retirer", "Remove")} onCancel={() => setConfirmRemove(false)}
        onConfirm={() => start(async () => {
          const r = await removeAssignment(a.id);
          if (!r.ok) toast.error(tm(r.error)); else toast.success(tm(r.message ?? "Affectation retirée"));
          setConfirmRemove(false);
          router.refresh();
        })}
      />
    </li>
  );
}

/** « Sélectionné » n’est ni « contacté » ni « confirmé » : chaque étape est déclarée par le manager. */
export function AssignmentsPanel({ rows, locked }: { rows: AssignmentRow[]; locked: boolean }) {
  const { t } = usePreferences();
  if (rows.length === 0) return <p className="text-sm text-muted">{t("Aucun staff sélectionné pour l’instant.", "No staff selected yet.")}</p>;
  return <ul className="divide-y divide-line">{rows.map((a) => <Row key={a.id} a={a} locked={locked} />)}</ul>;
}
