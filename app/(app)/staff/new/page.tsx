import { PageHeader } from "@/components/ui/card";
import { T } from "@/components/providers/t";
import { StaffForm } from "@/components/staff/staff-form";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "Ajouter un staff" };

export default async function NewStaffPage() {
  const { profile } = await requireSession();
  return (
    <>
      <PageHeader title={<T fr="Ajouter un staff" en="Add staff" />} description={<T fr="Choisir une ville remplit automatiquement le code postal." en="Choosing a city fills in the postcode automatically." />} />
      <StaffForm defaultCountry={profile.country_code} timeZone={profile.timezone} />
    </>
  );
}
