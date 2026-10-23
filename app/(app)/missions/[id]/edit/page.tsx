import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MissionForm } from "@/components/missions/mission-form";
import { Alert, PageHeader } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { getRoutingCapabilities } from "@/lib/routing/service";
import type { Mission } from "@/lib/types";
import { uuidSchema } from "@/lib/validation";

export const metadata = { title: "Modifier la mission" };

export default async function EditMissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { supabase, profile } = await requireSession();
  const { data } = await supabase.from("missions").select("*").eq("id", id).maybeSingle();
  const mission = data as Mission | null;
  if (!mission) notFound();
  const caps = getRoutingCapabilities();

  return (
    <>
      <Link href={`/missions/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour à la mission</Link>
      <PageHeader title="Modifier la mission" description={mission.title} />
      <div className="max-w-3xl">
        {mission.status === "cancelled" ? (
          <Alert tone="warning" title="Mission annulée">Une mission annulée ne peut plus être modifiée.</Alert>
        ) : (
          <MissionForm mission={mission} defaultCountry={profile.country_code} timeZone={profile.timezone} supportedModes={caps.supportedModes} defaultMode={profile.default_transport_mode} />
        )}
      </div>
    </>
  );
}
