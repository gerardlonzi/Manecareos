import { SettingsTabs } from "@/components/settings/settings-tabs";
import { PageHeader } from "@/components/ui/card";
import { T } from "@/components/providers/t";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title={<T fr="Réglages" en="Settings" />} description={<T fr="Votre compte, vos préférences de recherche et la sécurité." en="Your account, search preferences and security." />} />
      <SettingsTabs />
      <div className="w-full max-w-none">{children}</div>
    </>
  );
}
