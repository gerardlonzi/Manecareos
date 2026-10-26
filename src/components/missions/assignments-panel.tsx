"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeAssignment, setAssignmentStatus } from "@/actions/assignments";
import { ContactButtons } from "@/components/staff/contact-buttons";
import { AssignmentBadge, AvailabilityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Avatar } from "@/components/ui/avatar";
import { usePreferences } from "@/components/providers/preferences-provider";
import type { AssignmentStatus, AvailabilityStatus } from "@/lib/types";

export type AssignmentRow = {
  id: string;
  status: AssignmentStatus;
  staffId: string;
  name: string;
  phone: string | null;
  availability: AvailabilityStatus;
  archived: boolean;
  photoUrl?: string | null;
};

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
