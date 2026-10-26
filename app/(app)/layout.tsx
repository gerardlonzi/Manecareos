import { AppShell } from "@/components/layout/nav";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireSession();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return (
    <AppShell name={profile.full_name} company={profile.company_name} unread={count ?? 0}>
      {children}
    </AppShell>
  );
}
