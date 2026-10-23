import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ProfileForm } from "@/components/settings/settings-forms";
import { requireSession } from "@/lib/auth";
import { COUNTRIES } from "@/config/countries";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Profil du manager" };

export default async function ProfilePage() {
  const { profile, user } = await requireSession();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Compte" />
        <CardBody>
          <dl className="divide-y divide-line text-sm">
            <div className="grid grid-cols-3 gap-3 py-2.5"><dt className="text-muted">E-mail</dt><dd className="col-span-2 break-all">{user.email}</dd></div>
            <div className="grid grid-cols-3 gap-3 py-2.5"><dt className="text-muted">Pays principal</dt><dd className="col-span-2">{COUNTRIES[profile.country_code]?.name ?? profile.country_code}</dd></div>
            <div className="grid grid-cols-3 gap-3 py-2.5"><dt className="text-muted">Compte créé le</dt><dd className="col-span-2">{formatDateTime(user.created_at, profile.timezone)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted">L’adresse e-mail est celle de votre compte Supabase Auth. Données personnelles : voir la <a className="text-primary underline" href="/privacy">politique de confidentialité</a>.</p>
        </CardBody>
      </Card>
      <ProfileForm profile={profile} />
    </div>
  );
}
