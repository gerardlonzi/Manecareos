import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { privateDownloadUrl } from "@/lib/cloudinary";
import { uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Téléchargement sécurisé : session + 2FA + propriété vérifiées (RLS), accès journalisé, URL Cloudinary signée valable 2 minutes. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!uuidSchema.safeParse(id).success) return new NextResponse("Bad request", { status: 400 });

  const { supabase, user } = session;
  const { data } = await supabase.from("staff_documents").select("id, staff_id, file_public_id, file_resource_type, file_format, link_url").eq("id", id).maybeSingle();
  const d = data as { id: string; staff_id: string; file_public_id: string | null; file_resource_type: string | null; file_format: string | null; link_url: string | null } | null;
  if (d?.link_url && !d.file_public_id && /^https:\/\//i.test(d.link_url)) {
    await supabase.from("document_access_log").insert({ owner_id: user.id, staff_id: d.staff_id, document_id: d.id, action: "view" });
    return new NextResponse(null, { status: 302, headers: { Location: d.link_url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  }
  if (!d?.file_public_id) return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  await supabase.from("document_access_log").insert({ owner_id: user.id, staff_id: d.staff_id, document_id: d.id, action: "view" });
  const url = privateDownloadUrl(d.file_public_id, d.file_format ?? "pdf", d.file_resource_type ?? "image", 120);
  return new NextResponse(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
