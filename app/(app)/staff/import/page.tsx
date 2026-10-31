import { ImportWizard } from "@/components/import/import-wizard";
import { PageHeader } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata() { const { t } = await getT(); return { title: t("Importer du staff", "Import staff") }; }

export default async function ImportStaffPage() {
  const [{ profile }, { t }] = await Promise.all([requireSession(), getT()]);
  return (
    <>
      <PageHeader title={t("Importer du staff", "Import staff")} description={t("Importez ou mettez à jour votre liste depuis Excel ou CSV : aperçu, validation ligne par ligne, puis import par lots.", "Import or update your list from Excel or CSV: preview, row-by-row validation, then batch import.")} />
      <div className="w-full max-w-none"><ImportWizard defaultCountry={profile.country_code} /></div>
    </>
  );
}
