"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Download, MapPinCheck, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { exportStaffCsv } from "@/actions/export";
import { archiveStaff, resolveStaffLocations, setAvailability } from "@/actions/staff";
import { AvailabilityBadge, LocationBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { downloadCsv } from "@/lib/download";
import { formatDate } from "@/lib/utils";
import type { AvailabilityStatus, Staff } from "@/lib/types";

type Props = { rows: Staff[]; timeZone: string };

export function StaffTable({ rows, timeZone }: Props) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [bulkAvail, setBulkAvail] = React.useState<AvailabilityStatus>("available");
  const [confirm, setConfirm] = React.useState<{ ids: string[]; restore: boolean } | null>(null);

  // La sélection est limitée à la page affichée ; elle est vidée quand la page change.
  const pageKey = rows.map((r) => r.id).join(",");
  const [sel, setSel] = React.useState<{ key: string; ids: Set<string> }>({ key: pageKey, ids: new Set() });
  const selected = sel.key === pageKey ? sel.ids : new Set<string>();
  const setSelected = (u: Set<string> | ((s: Set<string>) => Set<string>)) =>
    setSel((prev) => {
      const base = prev.key === pageKey ? prev.ids : new Set<string>();
      return { key: pageKey, ids: typeof u === "function" ? u(base) : u };
    });

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ids = [...selected];

  const done = (r: { ok: boolean; message?: string; error?: string }) => {
    if (r.ok) { toast.success(r.message ?? "Terminé"); setSelected(new Set()); router.refresh(); } else toast.error(r.error);
  };

  return (
    <div className="space-y-3">
      {selected.size > 0 ? (
        <div role="region" aria-label="Actions groupées" className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3">
          <p className="mr-2 text-sm font-medium">{selected.size} sélectionné(s) sur cette page</p>
          <Button size="sm" variant="secondary" pending={pending} onClick={() => start(async () => {
            const r = await exportStaffCsv({ scope: "selected", ids });
            if (!r.ok || !r.data) { toast.error(r.ok ? "Export vide" : r.error); return; }
            downloadCsv(r.data.filename, r.data.csv);
            toast.success(`${r.data.count} ligne(s) exportée(s)`);
          })}><Download className="h-4 w-4" aria-hidden /> Exporter la sélection</Button>
          <span className="flex items-center gap-1">
            <Select aria-label="Nouvelle disponibilité" className="h-8 w-40" value={bulkAvail} onChange={(e) => setBulkAvail(e.target.value as AvailabilityStatus)}>
              <option value="available">Disponible</option><option value="unavailable">Indisponible</option><option value="unknown">Inconnue</option>
            </Select>
            <Button size="sm" variant="secondary" pending={pending} onClick={() => start(async () => done(await setAvailability(ids, bulkAvail)))}>Appliquer</Button>
          </span>
          <Button size="sm" variant="secondary" pending={pending} onClick={() => start(async () => done(await resolveStaffLocations(ids)))}><MapPinCheck className="h-4 w-4" aria-hidden /> Revalider la localisation</Button>
          <Button size="sm" variant="outlineDanger" onClick={() => setConfirm({ ids, restore: false })}><Archive className="h-4 w-4" aria-hidden /> Archiver</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}><X className="h-4 w-4" aria-hidden /> Désélectionner</Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="border-b border-line bg-bg text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="w-10 px-3 py-3"><input type="checkbox" aria-label="Sélectionner les lignes de cette page" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} className="h-4 w-4 accent-primary" /></th>
              <th className="px-3 py-3 font-medium">Nom</th>
              <th className="px-3 py-3 font-medium">Code</th>
              <th className="px-3 py-3 font-medium">Téléphone</th>
              <th className="px-3 py-3 font-medium">Localisation enregistrée</th>
              <th className="px-3 py-3 font-medium">Compétences</th>
              <th className="px-3 py-3 font-medium">Disponibilité</th>
              <th className="px-3 py-3 font-medium">Statut du lieu</th>
              <th className="px-3 py-3 font-medium">Mis à jour</th>
              <th className="px-3 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((s) => (
              <tr key={s.id} className={selected.has(s.id) ? "bg-primary-soft/50" : "hover:bg-bg/60"}>
                <td className="px-3 py-2.5"><input type="checkbox" aria-label={`Sélectionner ${s.full_name}`} checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 accent-primary" /></td>
                <td className="px-3 py-2.5 font-medium">
                  <Link href={`/staff/${s.id}`} className="hover:text-primary hover:underline">{s.full_name}</Link>
                  {s.archived_at ? <Badge className="ml-2">Archivé</Badge> : null}
                </td>
                <td className="px-3 py-2.5 text-muted">{s.staff_code ?? "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted">{s.phone ?? "—"}</td>
                <td className="px-3 py-2.5">{[s.postal_code, s.city].filter(Boolean).join(" · ") || <span className="text-muted">—</span>}<span className="ml-1 text-xs text-muted">{s.country_code}</span></td>
                <td className="max-w-48 px-3 py-2.5"><div className="flex flex-wrap gap-1">{s.skills.slice(0, 3).map((k) => <Badge key={k} tone="blue">{k}</Badge>)}{s.skills.length > 3 ? <Badge>+{s.skills.length - 3}</Badge> : null}</div></td>
                <td className="px-3 py-2.5">
                  <label className="sr-only" htmlFor={`av-${s.id}`}>Changer la disponibilité de {s.full_name}</label>
                  {s.archived_at ? <AvailabilityBadge status={s.availability_status} /> : (
                    <Select id={`av-${s.id}`} className="h-8 w-36 text-xs" value={s.availability_status} disabled={pending}
                      onChange={(e) => start(async () => done(await setAvailability([s.id], e.target.value as AvailabilityStatus)))}>
                      <option value="available">Disponible</option><option value="unavailable">Indisponible</option><option value="unknown">Inconnue</option>
                    </Select>
                  )}
                </td>
                <td className="px-3 py-2.5"><LocationBadge status={s.location_status} /></td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted">{formatDate(s.updated_at, timeZone)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Link href={`/staff/${s.id}`} className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft">Voir</Link>
                    <Link href={`/staff/${s.id}/edit`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-bg" aria-label={`Modifier ${s.full_name}`}><Pencil className="h-3.5 w-3.5" aria-hidden /> Modifier</Link>
                    <button type="button" onClick={() => setConfirm({ ids: [s.id], restore: Boolean(s.archived_at) })} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-danger-soft" aria-label={`${s.archived_at ? "Restaurer" : "Archiver"} ${s.full_name}`}>
                      {s.archived_at ? <ArchiveRestore className="h-3.5 w-3.5" aria-hidden /> : <Archive className="h-3.5 w-3.5" aria-hidden />} {s.archived_at ? "Restaurer" : "Archiver"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">La sélection ne concerne que les lignes de cette page.</p>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.restore ? "Restaurer ce staff ?" : `Archiver ${confirm?.ids.length ?? 0} staff ?`}
        description={confirm?.restore ? "Il réapparaîtra dans les recherches." : "Les fiches archivées disparaissent des recherches et des listes actives. Elles restent consultables et restaurables."}
        confirmLabel={confirm?.restore ? "Restaurer" : "Archiver"} destructive={!confirm?.restore} pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && start(async () => { const r = await archiveStaff(confirm.ids, !confirm.restore); setConfirm(null); done(r); })}
      />
    </div>
  );
}
