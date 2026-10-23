"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { archiveStaff, markContacted, setAvailability } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AvailabilityStatus } from "@/lib/types";

export function ProfileActions({ id, name, availability, archived }: { id: string; name: string; availability: AvailabilityStatus; archived: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [confirm, setConfirm] = React.useState(false);
  const act = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => { const r = await fn(); if (r.ok) { toast.success(r.message ?? "Terminé"); after?.(); router.refresh(); } else toast.error(r.error); });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!archived ? (
        <>
          <label className="sr-only" htmlFor="profile-availability">Changer la disponibilité</label>
          <Select id="profile-availability" className="h-9 w-44" value={availability} disabled={pending} onChange={(e) => act(() => setAvailability([id], e.target.value as AvailabilityStatus))}>
            <option value="available">Disponible</option><option value="unavailable">Indisponible</option><option value="unknown">Inconnue</option>
          </Select>
          <Button variant="secondary" pending={pending} onClick={() => act(() => markContacted(id))}><CheckCheck className="h-4 w-4" aria-hidden /> Marquer comme contacté</Button>
        </>
      ) : null}
      <Button variant={archived ? "secondary" : "outlineDanger"} onClick={() => setConfirm(true)}>
        {archived ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />} {archived ? "Restaurer" : "Archiver"}
      </Button>
      <ConfirmDialog
        open={confirm} title={archived ? `Restaurer ${name} ?` : `Archiver ${name} ?`}
        description={archived ? "Cette personne réapparaîtra dans les recherches." : "Elle disparaîtra des recherches et des listes actives, mais pourra être restaurée."}
        confirmLabel={archived ? "Restaurer" : "Archiver"} destructive={!archived} pending={pending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => act(() => archiveStaff([id], archived), () => { setConfirm(false); if (!archived) router.push("/staff"); })}
      />
    </div>
  );
}
