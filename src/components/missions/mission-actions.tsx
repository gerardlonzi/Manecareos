"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Download, MapPinCheck } from "lucide-react";
import { toast } from "sonner";
import { exportMissionStaffCsv, exportMissionsCsv } from "@/actions/export";
import { cancelMission, changeMissionStatus, revalidateMissionLocation } from "@/actions/missions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { usePreferences } from "@/components/providers/preferences-provider";
import { downloadCsv } from "@/lib/download";
import type { MissionStatus } from "@/lib/types";

/** Bouton « Annuler la mission » avec confirmation. */
export function CancelMissionButton({ id, title, size = "md", redirectTo }: { id: string; title: string; size?: "sm" | "md"; redirectTo?: string }) {
  const router = useRouter();
  const { t, tm } = usePreferences();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <>
      <Button variant="outlineDanger" size={size} onClick={() => setOpen(true)}><Ban className="h-4 w-4" aria-hidden /> {t("Annuler la mission", "Cancel assignment")}</Button>
      <ConfirmDialog
        open={open} destructive pending={pending} title={t("Annuler cette mission ?", "Cancel this assignment?")}
        description={t(`« ${title} » sera annulée et ses affectations en cours seront marquées « Annulé ». Une mission annulée ne peut pas être rouverte.`, `“${title}” will be cancelled and its active assignments marked “Cancelled”. A cancelled assignment cannot be reopened.`)}
        confirmLabel={t("Annuler la mission", "Cancel assignment")} cancelLabel={t("Conserver", "Keep")}
        onCancel={() => setOpen(false)}
        onConfirm={() => start(async () => {
          const r = await cancelMission(id);
          if (!r.ok) { toast.error(tm(r.error)); return; }
          toast.success(tm(r.message ?? "Mission annulée"));
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
  const { t, tm } = usePreferences();
  const [pending, start] = React.useTransition();
  const L: Record<MissionStatus, [string, string]> = { draft: ["Brouillon", "Draft"], open: ["Ouverte", "Open"], staffing_in_progress: ["Recrutement en cours", "Staffing in progress"], staffed: ["Pourvue", "Staffed"], completed: ["Terminée", "Completed"], cancelled: ["Annulée", "Cancelled"] };
  const closed = status === "cancelled";
  const options = (Object.keys(L) as MissionStatus[]).filter((x) => x !== "cancelled" || closed).map((x) => ({
    value: x, label: t(...L[x]) + (x === "staffed" && confirmed < required ? ` (${confirmed}/${required} ${t("confirmés", "confirmed")})` : ""),
  }));
  return (
    <SearchablePicker id="mission-status" className="w-60" value={status} options={options} disabled={pending || closed}
      onValueChange={(next) => {
        if (next === "staffed" && confirmed < required) { toast.error(t(`Il faut ${required} personnes confirmées (${confirmed} actuellement).`, `${required} confirmed people are needed (${confirmed} so far).`)); return; }
        start(async () => {
          const r = await changeMissionStatus(id, next as MissionStatus);
          if (!r.ok) toast.error(tm(r.error)); else toast.success(tm(r.message ?? "Statut mis à jour"));
          router.refresh();
        });
      }} />
  );
}

export function RevalidateLocationButton({ id }: { id: string }) {
  const router = useRouter();
  const { t, tm } = usePreferences();
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant="secondary" size="sm" pending={pending}
      onClick={() => start(async () => {
        const r = await revalidateMissionLocation(id);
        if (r.ok) toast.success(tm(r.message ?? "Lieu vérifié")); else toast.error(tm(r.error));
        router.refresh();
      })}
    >
      {!pending ? <MapPinCheck className="h-4 w-4" aria-hidden /> : null} {t("Revalider le lieu", "Revalidate location")}
    </Button>
  );
}

export function ExportMissionStaffButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const { t, tm } = usePreferences();
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant="secondary" pending={pending} disabled={disabled}
      onClick={() => start(async () => {
        const r = await exportMissionStaffCsv(id);
        if (!r.ok || !r.data) { toast.error(tm(r.ok ? "Aucune donnée à exporter." : r.error)); return; }
        downloadCsv(r.data.filename, r.data.csv);
        toast.success(t(`${r.data.count} ligne(s) exportée(s)`, `${r.data.count} row(s) exported`));
      })}
    >
      {!pending ? <Download className="h-4 w-4" aria-hidden /> : null} {t("Exporter le staff sélectionné", "Export selected staff")}
    </Button>
  );
}

export function ExportMissionsButton({ disabled }: { disabled?: boolean }) {
  const { t, tm } = usePreferences();
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant="secondary" pending={pending} disabled={disabled}
      onClick={() => start(async () => {
        const r = await exportMissionsCsv();
        if (!r.ok || !r.data) { toast.error(tm(r.ok ? "Aucune donnée à exporter." : r.error)); return; }
        downloadCsv(r.data.filename, r.data.csv);
        toast.success(t(`${r.data.count} mission(s) exportée(s)`, `${r.data.count} assignment(s) exported`));
      })}
    >
      {!pending ? <Download className="h-4 w-4" aria-hidden /> : null} {t("Exporter", "Export")}
    </Button>
  );
}
