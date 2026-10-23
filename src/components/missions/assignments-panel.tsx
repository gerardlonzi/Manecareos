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
import type { AssignmentStatus, AvailabilityStatus } from "@/lib/types";

export type AssignmentRow = {
  id: string;
  status: AssignmentStatus;
  staffId: string;
  name: string;
  phone: string | null;
  availability: AvailabilityStatus;
  archived: boolean;
};

function Row({ a, locked }: { a: AssignmentRow; locked: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  const set = (status: AssignmentStatus) =>
    start(async () => {
      const r = await setAssignmentStatus(a.id, status);
      if (!r.ok) toast.error(r.error); else toast.success(r.message ?? "Statut mis à jour");
      router.refresh();
    });

  const active = a.status === "selected" || a.status === "contacted" || a.status === "confirmed";
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/staff/${a.staffId}`} className="font-medium hover:text-primary hover:underline">{a.name}</Link>
          <AssignmentBadge status={a.status} />
          <AvailabilityBadge status={a.availability} />
        </div>
        <ContactButtons phone={a.phone} />
      </div>
      {!locked ? (
        <div className="flex flex-wrap gap-2">
          {a.status === "selected" ? <Button size="sm" variant="secondary" pending={pending} onClick={() => set("contacted")}>Marquer comme contacté</Button> : null}
          {(a.status === "selected" || a.status === "contacted") ? <Button size="sm" variant="secondary" pending={pending} onClick={() => set("confirmed")}>Marquer comme confirmé</Button> : null}
          {(a.status === "selected" || a.status === "contacted" || a.status === "confirmed") ? <Button size="sm" variant="secondary" pending={pending} onClick={() => set("declined")}>A refusé</Button> : null}
          {a.status === "confirmed" ? <Button size="sm" variant="secondary" pending={pending} onClick={() => set("completed")}>Marquer comme terminé</Button> : null}
          {(a.status === "declined" || a.status === "cancelled") ? <Button size="sm" variant="secondary" pending={pending} onClick={() => set("selected")}>Resélectionner</Button> : null}
          {active ? <Button size="sm" variant="outlineDanger" disabled={pending} onClick={() => setConfirmRemove(true)}>Retirer</Button> : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmRemove} destructive pending={pending} title="Retirer ce staff de la mission ?"
        description={<>{a.name} ne sera plus sélectionné pour cette mission. L’historique est conservé.</>}
        confirmLabel="Retirer" onCancel={() => setConfirmRemove(false)}
        onConfirm={() => start(async () => {
          const r = await removeAssignment(a.id);
          if (!r.ok) toast.error(r.error); else toast.success(r.message ?? "Affectation retirée");
          setConfirmRemove(false);
          router.refresh();
        })}
      />
    </li>
  );
}

/** « Sélectionné » n’est ni « contacté » ni « confirmé » : chaque étape est déclarée par le manager. */
export function AssignmentsPanel({ rows, locked }: { rows: AssignmentRow[]; locked: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-muted">Aucun staff sélectionné pour l’instant.</p>;
  return <ul className="divide-y divide-line">{rows.map((a) => <Row key={a.id} a={a} locked={locked} />)}</ul>;
}
