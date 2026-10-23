"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Download, MapPinCheck } from "lucide-react";
import { toast } from "sonner";
import { exportMissionStaffCsv, exportMissionsCsv } from "@/actions/export";
import { cancelMission, changeMissionStatus, revalidateMissionLocation } from "@/actions/missions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/form";
import { MISSION_STATUS_LABELS } from "@/config/app";
import { downloadCsv } from "@/lib/download";
import type { MissionStatus } from "@/lib/types";

/** Bouton « Annuler la mission » avec confirmation. */
export function CancelMissionButton({ id, title, size = "md", redirectTo }: { id: string; title: string; size?: "sm" | "md"; redirectTo?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <>
      <Button variant="outlineDanger" size={size} onClick={() => setOpen(true)}><Ban className="h-4 w-4" aria-hidden /> Annuler la mission</Button>
      <ConfirmDialog
        open={open} destructive pending={pending} title="Annuler cette mission ?"
        description={<>« {title} » sera annulée et ses affectations en cours seront marquées « Annulé ». Une mission annulée ne peut pas être rouverte.</>}
        confirmLabel="Annuler la mission" cancelLabel="Conserver"
        onCancel={() => setOpen(false)}
        onConfirm={() => start(async () => {
          const r = await cancelMission(id);
          if (!r.ok) { toast.error(r.error); return; }
          toast.success(r.message ?? "Mission annulée");
          setOpen(false);
          if (redirectTo) router.push(redirectTo);
          router.refresh();
        })}
      />
    </>
  );
}

/** Changement manuel de statut. « Pourvue » exige des affectations confirmées (vérifié aussi côté serveur). */
export function StatusSelect({ id, status, confirmed, required }: { id: string; status: MissionStatus; confirmed: number; required: number }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const closed = status === "cancelled";
  const options = (Object.keys(MISSION_STATUS_LABELS) as MissionStatus[]).filter((s) => s !== "cancelled");
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="mission-status" className="sr-only">Changer le statut</label>
      <Select
        id="mission-status" className="h-9 w-56" value={status} disabled={pending || closed}
        onChange={(e) => {
          const next = e.target.value as MissionStatus;
          start(async () => {
            const r = await changeMissionStatus(id, next);
            if (!r.ok) toast.error(r.error); else toast.success(r.message ?? "Statut mis à jour");
            router.refresh();
          });
        }}
      >
        {options.map((s) => (
          <option key={s} value={s} disabled={s === "staffed" && confirmed < required}>
            {MISSION_STATUS_LABELS[s]}{s === "staffed" && confirmed < required ? ` (${confirmed}/${required} confirmés)` : ""}
          </option>
        ))}
        {closed ? <option value="cancelled">{MISSION_STATUS_LABELS.cancelled}</option> : null}
      </Select>
    </div>
  );
}

export function RevalidateLocationButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant="secondary" size="sm" pending={pending}
      onClick={() => start(async () => {
        const r = await revalidateMissionLocation(id);
        if (r.ok) toast.success(r.message ?? "Lieu vérifié"); else toast.error(r.error);
        router.refresh();
      })}
    >
      {!pending ? <MapPinCheck className="h-4 w-4" aria-hidden /> : null} Revalider le lieu
    </Button>
  );
}

export function ExportMissionStaffButton({ id }: { id: string }) {
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant="secondary" pending={pending}
      onClick={() => start(async () => {
        const r = await exportMissionStaffCsv(id);
        if (!r.ok || !r.data) { toast.error(r.ok ? "Export vide" : r.error); return; }
        downloadCsv(r.data.filename, r.data.csv);
        toast.success(`${r.data.count} ligne(s) exportée(s)`);
      })}
    >
      {!pending ? <Download className="h-4 w-4" aria-hidden /> : null} Exporter le staff sélectionné
    </Button>
  );
}

export function ExportMissionsButton() {
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant="secondary" pending={pending}
      onClick={() => start(async () => {
        const r = await exportMissionsCsv();
        if (!r.ok || !r.data) { toast.error(r.ok ? "Export vide" : r.error); return; }
        downloadCsv(r.data.filename, r.data.csv);
        toast.success(`${r.data.count} mission(s) exportée(s)`);
      })}
    >
      {!pending ? <Download className="h-4 w-4" aria-hidden /> : null} Exporter
    </Button>
  );
}
