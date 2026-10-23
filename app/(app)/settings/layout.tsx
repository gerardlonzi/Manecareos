import { SettingsTabs } from "@/components/settings/settings-tabs";
import { PageHeader } from "@/components/ui/card";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Réglages" description="Votre compte, vos préférences de recherche et la sécurité." />
      <SettingsTabs />
      <div className="max-w-3xl">{children}</div>
    </>
  );
}
