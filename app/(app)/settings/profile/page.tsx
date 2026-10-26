import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ProfileForm } from "@/components/settings/settings-forms";
import { requireSession } from "@/lib/auth";
import { COUNTRIES } from "@/config/countries";
import { formatDateTime } from "@/lib/utils";
import { logout } from "@/actions/auth";
import { LogOut } from "lucide-react";
import { T } from "@/components/providers/t";

export const metadata = { title: "Profil du manager" };

export default async function ProfilePage() {
  const { profile, user } = await requireSession();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={<T fr="Compte" en="Account" />} />
        <CardBody>
          <dl className="divide-y divide-line text-sm">
            <div className="grid grid-cols-3 gap-3 py-2.5"><dt className="text-muted"><T fr="E-mail" en="Email" /></dt><dd className="col-span-2 break-all">{user.email}</dd></div>
            <div className="grid grid-cols-3 gap-3 py-2.5"><dt className="text-muted"><T fr="Pays principal" en="Primary country" /></dt><dd className="col-span-2">{COUNTRIES[profile.country_code]?.name ?? profile.country_code}</dd></div>
            <div className="grid grid-cols-3 gap-3 py-2.5"><dt className="text-muted"><T fr="Compte créé le" en="Account created" /></dt><dd className="col-span-2">{formatDateTime(user.created_at, profile.timezone)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted"><T fr="L’adresse e-mail correspond à votre compte. Données personnelles : consultez la" en="This email address belongs to your account. For personal data details, read the" /> <a className="text-primary underline" href="/privacy"><T fr="politique de confidentialité" en="privacy policy" /></a>.</p>
        </CardBody>
      </Card>
      <ProfileForm profile={profile} />
      <Card>
        <CardHeader title={<T fr="Session" en="Session" />} description={<T fr="Terminez votre session sur cet appareil." en="End your session on this device." />} />
        <CardBody>
          <form action={logout} className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted"><T fr="Vous pourrez vous reconnecter avec votre adresse e-mail et votre mot de passe." en="You can sign in again with your email address and password." /></p>
            <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-surface px-4 text-sm font-semibold text-danger transition hover:bg-danger-soft"><LogOut className="h-4 w-4" aria-hidden/><T fr="Se déconnecter" en="Log out" /></button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
