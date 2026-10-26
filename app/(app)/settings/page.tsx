import { ProfileForm } from "@/components/settings/settings-forms";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "Réglages" };

export default async function SettingsPage() {
  const { profile } = await requireSession();
  return <ProfileForm profile={profile} />;
}
