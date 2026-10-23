import * as React from "react";
import { Plus, Upload, Users } from "lucide-react";
import { ResolveLocationsButton, StaffHeaderActions } from "@/components/staff/staff-actions";
import { StaffFiltersBar } from "@/components/staff/staff-filters";
import { StaffTable } from "@/components/staff/staff-table";
import { LinkButton } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { requireSession } from "@/lib/auth";
import { applyStaffFilters, parseStaffFilters, staffFiltersToParams } from "@/lib/staff-query";
import type { Staff } from "@/lib/types";
import { toQuery } from "@/lib/utils";

export const metadata = { title: "Annuaire du staff" };

export default async function StaffDirectoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, profile } = await requireSession();
  const filters = parseStaffFilters(await searchParams);

  const from = (filters.page - 1) * filters.pageSize;
  const base = supabase.from("staff").select("*", { count: "exact" }).order("full_name", { ascending: true });
  const [{ data, count, error }, { count: unresolved }] = await Promise.all([
    applyStaffFilters(base, filters).range(from, from + filters.pageSize - 1),
    supabase.from("staff").select("id", { count: "exact", head: true }).is("archived_at", null).eq("location_status", "pending"),
  ]);

  const rows = (data ?? []) as Staff[];
  const total = count ?? 0;
  const hasFilters = Boolean(filters.q || filters.city || filters.region || filters.skill || filters.country || filters.availability !== "all" || filters.location !== "all" || filters.archived !== "active");

  return (
    <>
      <PageHeader
        title="Annuaire du staff"
        description="Localisations enregistrées dans chaque fiche — ce ne sont pas des positions en direct."
        actions={
          <>
            <LinkButton href="/staff/new"><Plus className="h-4 w-4" aria-hidden /> Ajouter un staff</LinkButton>
            <LinkButton href="/staff/import" variant="secondary"><Upload className="h-4 w-4" aria-hidden /> Importer un CSV</LinkButton>
            <React.Suspense fallback={null}><StaffHeaderActions /></React.Suspense>
          </>
        }
      />

      <div className="space-y-4">
        <StaffFiltersBar filters={filters} />
        {(unresolved ?? 0) > 0 ? (
          <Alert tone="warning" title={`${unresolved} localisation(s) en attente de vérification`}>
            <p>Ces personnes n’apparaissent pas dans les recherches par distance tant que leur lieu n’est pas résolu.</p>
            <div className="mt-2"><ResolveLocationsButton count={unresolved ?? 0} /></div>
          </Alert>
        ) : null}
        {error ? <Alert tone="danger" title="Lecture impossible">La liste n’a pas pu être chargée. Vérifiez la configuration Supabase puis actualisez.</Alert> : null}

        {!error && rows.length === 0 ? (
          hasFilters ? (
            <EmptyState icon={<Users className="h-8 w-8" aria-hidden />} title="Aucun résultat" description="Aucun staff ne correspond à ces filtres." actions={<LinkButton href="/staff" variant="secondary">Effacer les filtres</LinkButton>} />
          ) : (
            <EmptyState icon={<Users className="h-8 w-8" aria-hidden />} title="Aucun staff pour l’instant" description="Ajoutez une première fiche ou importez votre liste depuis un fichier CSV."
              actions={<><LinkButton href="/staff/new">Ajouter un staff</LinkButton><LinkButton href="/staff/import" variant="secondary">Importer un CSV</LinkButton></>} />
          )
        ) : null}

        {rows.length > 0 ? (
          <>
            <StaffTable rows={rows} timeZone={profile.timezone} />
            <Pagination page={filters.page} pageSize={filters.pageSize} total={total} hrefFor={(p) => `/staff${toQuery(staffFiltersToParams(filters, { page: p <= 1 ? "" : p }))}`} />
          </>
        ) : null}
      </div>
    </>
  );
}
