import { PageHeader } from "@/components/ui/card";
import { T } from "@/components/providers/t";
import { StaffForm } from "@/components/staff/staff-form";
import { requireSession } from "@/lib/auth";
import { loadDocTypes } from "@/lib/compliance";

export const metadata = { title: "Ajouter un staff" };

export default async function NewStaffPage() {
  const { supabase, profile } = await requireSession();
  const docTypes = await loadDocTypes(supabase);
  return (
    <>
      <StaffForm defaultCountry={profile.country_code} timeZone={profile.timezone} docTypes={docTypes} />
    </>
  );
}
