import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/card";
import { StaffForm } from "@/components/staff/staff-form";
import { requireSession } from "@/lib/auth";
import type { Staff } from "@/lib/types";
import { uuidSchema } from "@/lib/validation";

export const metadata = { title: "Modifier un staff" };

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { supabase, profile } = await requireSession();
  const { data } = await supabase.from("staff").select("*").eq("id", id).maybeSingle();
  const staff = data as Staff | null;
  if (!staff) notFound();
  return (
    <>
      <PageHeader title={`Modifier ${staff.full_name}`} />
      <div className="max-w-3xl"><StaffForm staff={staff} defaultCountry={profile.country_code} timeZone={profile.timezone} /></div>
    </>
  );
}
