"use client";
import * as React from "react";
import { Download, MapPinCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { exportStaffCsv } from "@/actions/export";
import { resolveStaffLocations } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { RefreshButton } from "@/components/ui/refresh-button";
import { usePreferences } from "@/components/providers/preferences-provider";
import { downloadCsv } from "@/lib/download";

/** Export (désactivé quand la liste est vide) + Actualiser. */
export function StaffHeaderActions({ total }: { total: number }) {
  const { t, tm } = usePreferences();
  const sp = useSearchParams();
  const [pending, start] = React.useTransition();
  const hasFilters = [...sp.keys()].some((k) => !["page", "pageSize"].includes(k));
  const run = (scope: "all" | "filtered") => start(async () => {
    const r = await exportStaffCsv({ scope, filters: Object.fromEntries([...sp.entries()]) });
    if (!r.ok || !r.data) { toast.error(tm(r.ok ? "Aucune donnée à exporter." : r.error)); return; }
    downloadCsv(r.data.filename, r.data.csv);
    toast.success(t(`${r.data.count} ligne(s) exportée(s)`, `${r.data.count} row(s) exported`));
  });
  return (
    <>
      <DropdownMenu label={t("Exporter", "Export")} icon={<Download className="h-4 w-4" aria-hidden />} pending={pending} disabled={total === 0}
        items={[{ label: t("Tout exporter (staff actifs)", "Export all (active staff)"), onSelect: () => run("all") }, { label: t("Exporter les résultats filtrés", "Export filtered results"), onSelect: () => run("filtered"), disabled: !hasFilters }]} />
      <RefreshButton />
    </>
  );
}

export function ResolveLocationsButton({ count }: { count: number }) {
  const router = useRouter();
  const { t, tm } = usePreferences();
  const [pending, start] = React.useTransition();
  return (
    <Button variant="secondary" size="sm" pending={pending} onClick={() => start(async () => {
      const r = await resolveStaffLocations();
      if (r.ok) { toast.success(tm(r.message ?? "Terminé")); router.refresh(); } else toast.error(tm(r.error));
    })}>
      <MapPinCheck className="h-4 w-4" aria-hidden /> {t(`Résoudre les ${count} localisation(s) en attente`, `Resolve ${count} pending location(s)`)}
    </Button>
  );
}
