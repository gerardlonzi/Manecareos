import { ImportWizard } from "@/components/import/import-wizard";
import { PageHeader } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "Importer du staff" };

export default async function ImportStaffPage() {
  const { profile } = await requireSession();
  return (
    <>
      <PageHeader title="Importer du staff" description="Importez votre liste depuis un CSV : aperçu, validation ligne par ligne, puis import par lots." />
      <div className="max-w-4xl"><ImportWizard defaultCountry={profile.country_code} /></div>
    </>
  );
}
