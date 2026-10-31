import { DocumentTypesManager } from "@/components/settings/document-types-manager";
import { requireSession } from "@/lib/auth";
import { loadDocTypes } from "@/lib/compliance";
import { isEmailConfigured } from "@/lib/email/brevo";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata() { const { t } = await getT(); return { title: t("Documents obligatoires", "Mandatory documents") }; }

export default async function DocumentSettingsPage() {
  const { supabase, profile } = await requireSession();
  const types = await loadDocTypes(supabase, { includeArchived: true });
  return <DocumentTypesManager types={types} autoEmail={profile.auto_email_documents !== false} emailConfigured={isEmailConfigured()} />;
}
