import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/card";
import { T } from "@/components/providers/t";
import { StaffForm } from "@/components/staff/staff-form";
import { DocumentsPanel } from "@/components/staff/documents-panel";
import { requireSession } from "@/lib/auth";
import { complianceFor } from "@/lib/compliance";
import { isEmailConfigured } from "@/lib/email/brevo";
import { signPhotoUrls } from "@/lib/photos";
import type { Staff } from "@/lib/types";
import { uuidSchema } from "@/lib/validation";

export const metadata = { title: "Modifier un staff" };

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { supabase, profile } = await requireSession();
  const { data } = await supabase.from("staff").select("*").eq("id", id).maybeSingle();
  const staff = data as Staff | null;
  if (!staff) notFound();
  const [photos, comp] = await Promise.all([signPhotoUrls(supabase, [staff]), complianceFor(supabase, [staff.id])]);
  return (
    <>
      <PageHeader title={<T fr={`Modifier ${staff.full_name}`} en={`Edit ${staff.full_name}`} />} />
      <StaffForm staff={staff} photoUrl={photos[staff.id]} defaultCountry={profile.country_code} timeZone={profile.timezone}
        documents={<DocumentsPanel staffId={staff.id} types={comp.types} docs={comp.docs.get(staff.id) ?? []} canEmail={isEmailConfigured()} hasEmail={Boolean(staff.email)} />} />
    </>
  );
}
