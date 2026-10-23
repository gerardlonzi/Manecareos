import { PageHeader } from "@/components/ui/card";
import { StaffForm } from "@/components/staff/staff-form";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "Ajouter un staff" };

export default async function NewStaffPage() {
  const { profile } = await requireSession();
  return (
    <>
      <PageHeader title="Ajouter un staff" description="La localisation est validée par le fournisseur de géocodage : aucune coordonnée n’est inventée." />
      <div className="max-w-3xl"><StaffForm defaultCountry={profile.country_code} timeZone={profile.timezone} /></div>
    </>
  );
}
