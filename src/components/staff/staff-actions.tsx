"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, RefreshCw, MapPinCheck } from "lucide-react";
import { toast } from "sonner";
import { exportStaffCsv } from "@/actions/export";
import { resolveStaffLocations } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/download";

/** Boutons d’en-tête de l’annuaire : Exporter (tout / filtré) et Actualiser. */
export function StaffHeaderActions() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = React.useTransition();
  const [refreshing, startRefresh] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const hasFilters = [...sp.keys()].some((k) => !["page", "pageSize"].includes(k));

  const run = (scope: "all" | "filtered") => {
    setOpen(false);
    start(async () => {
      const filters = Object.fromEntries([...sp.entries()]);
      const r = await exportStaffCsv({ scope, filters });
      if (!r.ok || !r.data) { toast.error(r.ok ? "Export vide" : r.error); return; }
      downloadCsv(r.data.filename, r.data.csv);
      toast.success(`${r.data.count} ligne(s) exportée(s)`);
    });
  };

  return (
    <>
      <div className="relative">
        <Button variant="secondary" pending={pending} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
          <Download className="h-4 w-4" aria-hidden /> Exporter
        </Button>
        {open ? (
          <div role="menu" className="absolute right-0 z-20 mt-2 w-60 rounded-lg border border-line bg-surface p-1 shadow-xl">
            <button role="menuitem" className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-bg" onClick={() => run("all")}>Tout exporter (staff actifs)</button>
            <button role="menuitem" disabled={!hasFilters} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-bg disabled:opacity-50" onClick={() => run("filtered")}>Exporter les résultats filtrés</button>
          </div>
        ) : null}
      </div>
      <Button variant="secondary" pending={refreshing} onClick={() => startRefresh(() => router.refresh())}>
        <RefreshCw className="h-4 w-4" aria-hidden /> Actualiser
      </Button>
    </>
  );
}

export function ResolveLocationsButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant="secondary" size="sm" pending={pending}
      onClick={() => start(async () => {
        const r = await resolveStaffLocations();
        if (r.ok) { toast.success(r.message ?? "Terminé"); router.refresh(); } else toast.error(r.error);
      })}
    >
      <MapPinCheck className="h-4 w-4" aria-hidden /> Résoudre les {count} localisation(s) en attente
    </Button>
  );
}
