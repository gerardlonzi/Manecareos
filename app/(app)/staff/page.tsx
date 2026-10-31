import * as React from "react";
import { Plus, Upload, Users } from "lucide-react";
import { ResolveLocationsButton, StaffHeaderActions } from "@/components/staff/staff-actions";
import { StaffToolbar } from "@/components/staff/staff-filters";
import { StaffTable } from "@/components/staff/staff-table";
import { LinkButton } from "@/components/ui/button";
import { T } from "@/components/providers/t";
import { Alert, EmptyState, PageHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { requireSession } from "@/lib/auth";
import { complianceFor, currentWeekHours } from "@/lib/compliance";
import { signPhotoUrls } from "@/lib/photos";
import { applyStaffFilters, parseStaffFilters, staffFiltersToParams } from "@/lib/staff-query";
import type { Staff } from "@/lib/types";
import { toQuery } from "@/lib/utils";
import { DismissibleAlert } from "@/components/ui/dismissible-alert";

export const metadata = { title: "Staff" };

export default async function StaffDirectoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await requireSession();
  const filters = parseStaffFilters(await searchParams);
  const from = (filters.page - 1) * filters.pageSize;
  const base = supabase.from("staff").select("*", { count: "exact" }).order("full_name", { ascending: true });
  const [{ data, count, error }, { count: unresolved }] = await Promise.all([
    applyStaffFilters(base, filters).range(from, from + filters.pageSize - 1),
    supabase.from("staff").select("id", { count: "exact", head: true }).is("archived_at", null).eq("location_status", "pending"),
  ]);
  const rows = (data ?? []) as Staff[];
  const [photos, comp, weekMap] = await Promise.all([signPhotoUrls(supabase, rows), complianceFor(supabase, rows.map((r) => r.id)), currentWeekHours(supabase)]);
  const compliance = Object.fromEntries(comp.byStaff);
  const weekHours = Object.fromEntries([...weekMap].map(([k, v]) => [k, v.total]));
  const total = count ?? 0;
  const hasFilters = Boolean(filters.q || filters.city || filters.region || filters.skill || filters.country || filters.availability !== "all" || filters.location !== "all" || filters.archived !== "active");

  return (
    <>
      <PageHeader
        title={<T fr="Annuaire du staff" en="Staff directory" />}
        description={<T fr={`${total} personne(s) · lieux enregistrés sur chaque fiche, pas de position en direct`} en={`${total} people · locations saved on each profile, not live positions`} />}
        actions={<>
          <LinkButton href="/staff/new"><Plus className="h-4 w-4" aria-hidden /><T fr="Ajouter" en="Add staff" /></LinkButton>
          <LinkButton href="/staff/import" variant="secondary"><Upload className="h-4 w-4" aria-hidden /><T fr="Importer" en="Import" /></LinkButton>
          <StaffHeaderActions total={total} />
        </>}
        toolbar={<StaffToolbar filters={filters} />}
      />
      <div className="space-y-4">
      {(unresolved ?? 0) > 0 ? (
          <DismissibleAlert id="staff-unresolved-locations" version={unresolved ?? 0} tone="warning" title={<T fr={`${unresolved} localisation(s) en attente de vérification`} en={`${unresolved} location(s) awaiting verification`} />}>
            <p><T fr="Ces personnes n’apparaissent pas dans les recherches par distance tant que leur lieu n’est pas résolu." en="These people will not appear in distance searches until their location is resolved." /></p>
            <div className="mt-2"><ResolveLocationsButton count={unresolved ?? 0} /></div>
          </DismissibleAlert>
        ) : null}
        {error ? <Alert tone="danger" title={<T fr="Lecture impossible" en="Unable to load" />}><T fr="La liste n’a pas pu être chargée. Réessayez dans un instant." en="The list could not be loaded. Please try again shortly." /></Alert> : null}
        {!error && rows.length === 0 ? (
          hasFilters ? (
            <EmptyState icon={<Users className="h-8 w-8" aria-hidden />} title={<T fr="Aucun résultat" en="No results" />} description={<T fr="Aucun staff ne correspond à ces filtres." en="No staff match these filters." />} actions={<LinkButton href="/staff" variant="secondary"><T fr="Effacer les filtres" en="Clear filters" /></LinkButton>} />
          ) : (
            <EmptyState icon={<Users className="h-8 w-8" aria-hidden />} title={<T fr="Aucun staff pour l’instant" en="No staff yet" />} description={<T fr="Ajoutez une première fiche ou importez votre liste depuis un fichier CSV." en="Add your first profile or import your list from a CSV file." />}
              actions={<><LinkButton href="/staff/new"><T fr="Ajouter un staff" en="Add staff" /></LinkButton><LinkButton href="/staff/import" variant="secondary"><T fr="Importer un CSV" en="Import CSV" /></LinkButton></>} />
          )
        ) : null}
        {rows.length > 0 ? (
          <>
            <StaffTable rows={rows} photos={photos} compliance={compliance} weekHours={weekHours} />
            <Pagination page={filters.page} pageSize={filters.pageSize} total={total} basePath="/staff" params={staffFiltersToParams(filters, { page: "" })} />
          </>
        ) : null}
      </div>
    </>
  );
}
