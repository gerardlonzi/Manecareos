"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { archiveStaff, markContacted, setAvailability } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { usePreferences } from "@/components/providers/preferences-provider";
import type { AvailabilityStatus } from "@/lib/types";

export function ProfileActions({ id, name, availability, archived }: { id: string; name: string; availability: AvailabilityStatus; archived: boolean }) {
  const router = useRouter();
  const { t, tm } = usePreferences();
  const [pending, start] = React.useTransition();
  const [confirm, setConfirm] = React.useState(false);
  const act = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => { const r = await fn(); if (r.ok) { toast.success(tm(r.message ?? "Terminé")); after?.(); router.refresh(); } else toast.error(tm(r.error)); });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!archived ? (
        <>
          <SearchablePicker id="profile-availability" className="w-48" value={availability} disabled={pending} onValueChange={(v) => act(() => setAvailability([id], v as AvailabilityStatus))}
            options={[{ value: "available", label: t("Disponible", "Available") }, { value: "unavailable", label: t("Indisponible", "Unavailable") }, { value: "unknown", label: t("Inconnue", "Unknown") }]} />
          <Button variant="secondary" pending={pending} onClick={() => act(() => markContacted(id))}><CheckCheck className="h-4 w-4" aria-hidden /> {t("Marquer comme contacté", "Mark as contacted")}</Button>
        </>
      ) : null}
      <Button variant={archived ? "secondary" : "outlineDanger"} onClick={() => setConfirm(true)}>
        {archived ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />} {archived ? t("Restaurer", "Restore") : t("Archiver", "Archive")}
      </Button>
      <ConfirmDialog open={confirm} title={archived ? t(`Restaurer ${name} ?`, `Restore ${name}?`) : t(`Archiver ${name} ?`, `Archive ${name}?`)}
        description={archived ? t("Cette personne réapparaîtra dans les recherches.", "This person will reappear in searches.") : t("Elle disparaîtra des recherches et des listes actives, mais pourra être restaurée.", "They will leave searches and active lists but can be restored.")}
        confirmLabel={archived ? t("Restaurer", "Restore") : t("Archiver", "Archive")} destructive={!archived} pending={pending}
        onCancel={() => setConfirm(false)} onConfirm={() => act(() => archiveStaff([id], archived), () => { setConfirm(false); if (!archived) router.push("/staff"); })} />
    </div>
  );
}
