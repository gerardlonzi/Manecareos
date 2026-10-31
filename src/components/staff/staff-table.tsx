"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CheckCheck, Download, Eye, MapPinCheck, Pencil, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { exportStaffCsv } from "@/actions/export";
import { archiveStaff, resolveStaffLocations, setAvailability } from "@/actions/staff";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Flag } from "@/components/ui/flag";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { SkillChips } from "@/components/staff/skill-picker";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/providers/preferences-provider";
import { downloadCsv } from "@/lib/download";
import type { AvailabilityStatus, Staff } from "@/lib/types";
import type { Compliance } from "@/lib/documents";
import { ComplianceBadge, ComplianceTip } from "@/components/staff/compliance-badge";
import { HoursEditor } from "@/components/staff/hours-editor";

// Les cellules peuvent passer à la ligne (le texte français est plus long) ; la colonne Actions reste collée à droite et toujours visible.
const th = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted";
const td = "px-3 py-2 align-middle";
const stickyAct = "sticky right-0 z-[1] bg-surface shadow-[-8px_0_8px_-8px_rgb(15_27_42/0.18)]";

export function StaffTable({ rows, photos, compliance, weekHours }: { rows: Staff[]; photos: Record<string, string>; compliance: Record<string, Compliance>; weekHours: Record<string, number> }) {
  const { t, tm, locale } = usePreferences();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [confirm, setConfirm] = React.useState<{ ids: string[]; restore: boolean } | null>(null);
  const pageKey = rows.map((r) => r.id).join(",");
  const [sel, setSel] = React.useState<{ key: string; ids: Set<string> }>({ key: pageKey, ids: new Set() });
  const selected = sel.key === pageKey ? sel.ids : new Set<string>();
  const setSelected = (u: Set<string>) => setSel({ key: pageKey, ids: u });
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); setSelected(n); };
  const ids = [...selected];
  const done = (r: { ok: boolean; message?: string; error?: string }) => {
    if (r.ok) { toast.success(tm(r.message ?? "Terminé")); setSelected(new Set()); router.refresh(); } else toast.error(tm(r.error));
  };
  const avail: { v: AvailabilityStatus; fr: string; en: string }[] = [{ v: "available", fr: "Disponible", en: "Available" }, { v: "unavailable", fr: "Indisponible", en: "Unavailable" }, { v: "unknown", fr: "Inconnue", en: "Unknown" }];
  const availOptions = avail.map((a) => ({ value: a.v, label: locale === "fr" ? a.fr : a.en, dot: (a.v === "available" ? "green" : a.v === "unavailable" ? "red" : "amber") as "green" | "red" | "amber" }));

  return (
    <div>
      {/* Le tableau défile dans son propre cadre (horizontal ET vertical) : rien ne sort de la page quand le texte s'allonge (FR/EN), l'en-tête et la colonne Actions restent visibles. */}
      <div className="scroll-thin max-h-[calc(100dvh-var(--table-top)-6rem)] overflow-auto rounded-xl" style={{ "--table-top": "0px" } as React.CSSProperties}>
        <table className="data-table w-full min-w-[56rem] border-separate border-spacing-0 rounded-xl border border-line bg-surface text-sm shadow-[var(--shadow-card)]">
          <thead>
            {selected.size > 0 ? (
              <tr>
                <th colSpan={9} className="!px-3 !py-0 !normal-case">
                  <div role="region" aria-label={t("Actions groupées", "Bulk actions")} className="flex h-12 items-center gap-2 text-sm font-medium">
                    <input type="checkbox" aria-label={t("Tout désélectionner", "Deselect all")} checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} className="h-4 w-4 accent-[var(--color-primary)]" />
                    <span className="mr-auto whitespace-nowrap normal-case tracking-normal text-ink">{t(`${selected.size} sélectionné(s)`, `${selected.size} selected`)}</span>
                    <Button size="sm" variant="secondary" pending={pending} onClick={() => start(async () => {
                      const r = await exportStaffCsv({ scope: "selected", ids });
                      if (!r.ok || !r.data) { toast.error(tm(r.ok ? "Aucune donnée à exporter." : r.error)); return; }
                      downloadCsv(r.data.filename, r.data.csv);
                      toast.success(t(`${r.data.count} ligne(s) exportée(s)`, `${r.data.count} row(s) exported`));
                    })}><Download className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">{t("Exporter", "Export")}</span></Button>
                    <DropdownMenu size="sm" label={<span className="hidden sm:inline">{t("Disponibilité", "Availability")}</span>} icon={<CheckCheck className="h-4 w-4" aria-hidden />} pending={pending}
                      items={avail.map((a) => ({ label: locale === "fr" ? a.fr : a.en, onSelect: () => start(async () => done(await setAvailability(ids, a.v))) }))} />
                    <Button size="sm" variant="secondary" pending={pending} onClick={() => start(async () => done(await resolveStaffLocations(ids)))}><MapPinCheck className="h-4 w-4" aria-hidden /><span className="hidden lg:inline">{t("Revalider le lieu", "Revalidate location")}</span></Button>
                    <Button size="sm" variant="outlineDanger" onClick={() => setConfirm({ ids, restore: false })}><Archive className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">{t("Archiver", "Archive")}</span></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelected(new Set())} aria-label={t("Désélectionner", "Deselect")}><X className="h-4 w-4" aria-hidden /></Button>
                  </div>
                </th>
              </tr>
            ) : (
              <tr>
                <th className={`${th} w-10`}><input type="checkbox" aria-label={t("Sélectionner la page", "Select this page")} checked={allSelected} onChange={() => setSelected(new Set(rows.map((r) => r.id)))} className="h-4 w-4 accent-[var(--color-primary)]" /></th>
                <th className={th}>{t("Staff", "Staff")}</th>
                <th className={`${th} max-2xl:hidden`}>{t("Téléphone", "Phone")}</th>
                <th className={th}>{t("Localisation", "Location")}</th>
                <th className={th}>{t("Compétences", "Skills")}</th>
                <th className={th}>{t("Documents", "Documents")}</th>
                <th className={th}>{t("Heures (semaine)", "Hours (week)")}</th>
                <th className={th}>{t("Disponibilité", "Availability")}</th>
                <th className={`${th} ${stickyAct} text-right`}>{t("Actions", "Actions")}</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((s) => (
              <tr key={s.id} data-selected={selected.has(s.id)} className={cn("border-t border-line", compliance[s.id] && !compliance[s.id]!.complete && !s.archived_at && "bg-danger-soft/45 hover:bg-danger-soft/70")}>
                <td className={`${td} w-10`}><input type="checkbox" aria-label={t(`Sélectionner ${s.full_name}`, `Select ${s.full_name}`)} checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 accent-[var(--color-primary)]" /></td>
                <td className={td}>
                  <Link href={`/staff/${s.id}`} className="flex items-center gap-2.5 hover:text-primary">
                    <Avatar name={s.full_name} photoUrl={photos[s.id]} size={32} />
                    <span className="min-w-0"><span className="block max-w-[10rem] truncate font-medium leading-tight xl:max-w-[12rem]">{s.full_name}{s.archived_at ? <Badge className="ml-2">{t("Archivé", "Archived")}</Badge> : null}</span><span className="block font-mono text-[11px] leading-tight text-muted">{s.staff_code ?? "—"}</span></span>
                  </Link>
                </td>
                <td className={`${td} whitespace-nowrap text-muted max-2xl:hidden`}>{s.phone ?? "—"}</td>
                <td className={td}>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Flag code={s.country_code} region={s.region} />
                    <span className="max-w-[10rem] truncate">{s.city ?? <span className="text-muted">—</span>}</span>
                    {s.postal_code ? <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted ring-1 ring-line">{s.postal_code}</span> : null}
                    {s.location_status !== "resolved" ? <span title={s.location_status === "pending" ? t("Localisation à vérifier", "Location needs checking") : t("Localisation à revoir", "Location needs review")}><TriangleAlert className="h-3.5 w-3.5 text-warning" aria-hidden /></span> : null}
                  </span>
                </td>
                <td className={`${td} max-w-[12rem]`}><SkillChips skills={s.skills} /></td>
                <td className={`${td} whitespace-nowrap`}>{compliance[s.id] ? <ComplianceBadge compliance={compliance[s.id]!} /> : null}</td>
                <td className={td}><HoursEditor staffId={s.id} cap={s.weekly_hours} used={weekHours[s.id] ?? 0} disabled={Boolean(s.archived_at)} /></td>
                <td className={`${td} w-40 min-w-36`}>
                  <SearchablePicker id={`av-${s.id}`} size="sm" value={s.availability_status} options={availOptions} disabled={pending || !!s.archived_at}
                    onValueChange={(v) => start(async () => done(await setAvailability([s.id], v as AvailabilityStatus)))} />
                </td>
                <td className={`${td} ${stickyAct}`}>
                  <div className="flex justify-end gap-0.5">
                    <Link href={`/staff/${s.id}`} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-primary-soft hover:text-primary" aria-label={t(`Voir ${s.full_name}`, `View ${s.full_name}`)} title={t("Voir le profil", "View profile")}><Eye className="h-4 w-4" aria-hidden /></Link>
                    <Link href={`/staff/${s.id}/edit`} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-primary-soft hover:text-ink" aria-label={t(`Modifier ${s.full_name}`, `Edit ${s.full_name}`)} title={t("Modifier", "Edit")}><Pencil className="h-4 w-4" aria-hidden /></Link>
                    <button type="button" onClick={() => setConfirm({ ids: [s.id], restore: Boolean(s.archived_at) })} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-danger-soft hover:text-danger" aria-label={s.archived_at ? t(`Restaurer ${s.full_name}`, `Restore ${s.full_name}`) : t(`Archiver ${s.full_name}`, `Archive ${s.full_name}`)} title={s.archived_at ? t("Restaurer", "Restore") : t("Archiver", "Archive")}>
                      {s.archived_at ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.restore ? t("Restaurer ce staff ?", "Restore this staff member?") : t(`Archiver ${confirm?.ids.length ?? 0} staff ?`, `Archive ${confirm?.ids.length ?? 0} staff member(s)?`)}
        description={confirm?.restore ? t("Il réapparaîtra dans les recherches.", "The profile will reappear in searches.") : t("Les fiches archivées disparaissent des recherches et des listes actives, mais restent consultables et restaurables.", "Archived profiles leave active lists and searches but can still be viewed and restored.")}
        confirmLabel={confirm?.restore ? t("Restaurer", "Restore") : t("Archiver", "Archive")} destructive={!confirm?.restore} pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && start(async () => { const r = await archiveStaff(confirm.ids, !confirm.restore); setConfirm(null); done(r); })}
      />
    </div>
  );
}
