"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity, notify } from "@/lib/activity";
import { DOC_MAX_BYTES, DOC_MIME, deletePrivateFile, detectDocumentType, uploadPrivateFile } from "@/lib/cloudinary";
import { daysUntil, todayIso, type DocType } from "@/lib/documents";
import { isEmailConfigured, sendEmail } from "@/lib/email/brevo";
import { documentExpiryEmail } from "@/lib/email/templates";
import { loadDocTypes } from "@/lib/compliance";
import { raiseDocumentAlert } from "@/lib/document-alerts";
import type { ActionResult } from "@/lib/types";
import { fieldErrorsFrom, uuidSchema } from "@/lib/validation";
import { withSession } from "./helpers";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ)").refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "Date invalide")
  .refine((d) => d >= "1950-01-01" && d <= "2100-12-31", "Date hors limites");

const docSchema = z.object({
  staff_id: uuidSchema, type_id: uuidSchema,
  expires_at: z.string().trim().optional().transform((v) => v || null).pipe(day.nullable()),
  issued_at: z.string().trim().optional().transform((v) => v || null).pipe(day.nullable()),
  no_expiry: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  note: z.string().trim().max(200, "200 caractères maximum").optional().transform((v) => v || null),
});

/** Lien https uniquement (pas de javascript:, data:, http:, ni d'identifiants dans l'URL). */
function parseLink(raw: string): string | null {
  const v = raw.trim();
  if (!v || v.length > 500) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" || u.username || u.password || /\s/.test(v)) return null;
    return u.toString();
  } catch { return null; }
}

const revalidate = (staffId: string) => { revalidatePath(`/staff/${staffId}`); revalidatePath(`/staff/${staffId}/edit`); revalidatePath("/staff"); revalidatePath("/notifications"); revalidatePath("/dashboard"); };

/** Enregistre (ou remplace) le document d'un staff. La date d'expiration est obligatoire (ou « sans expiration ») ; le fichier est facultatif. */
export async function saveStaffDocument(staffId: string, typeId: string, formData: FormData): Promise<ActionResult> {
  return withSession(async ({ supabase, user, profile }) => {
    const parsed = docSchema.safeParse({
      staff_id: staffId, type_id: typeId,
      expires_at: String(formData.get("expires_at") ?? ""), issued_at: String(formData.get("issued_at") ?? ""),
      no_expiry: String(formData.get("no_expiry") ?? "false"), note: String(formData.get("note") ?? ""),
    });
    if (!parsed.success) return { ok: false, error: "Formulaire invalide", fieldErrors: fieldErrorsFrom(parsed.error) };
    const v = parsed.data;

    const [{ data: staff }, types] = await Promise.all([supabase.from("staff").select("id, full_name, email").eq("id", v.staff_id).maybeSingle(), loadDocTypes(supabase, { includeArchived: true })]);
    const type = types.find((t) => t.id === v.type_id);
    if (!staff || !type) return { ok: false, error: "Staff ou type de document introuvable" };

    const noExpiry = !type.can_expire || v.no_expiry;
    if (!noExpiry && !v.expires_at) return { ok: false, error: "La date d’expiration est obligatoire.", fieldErrors: { expires_at: "La date d’expiration est obligatoire" } };
    if (v.issued_at && v.expires_at && v.expires_at < v.issued_at) return { ok: false, error: "La date d’expiration précède la date d’émission.", fieldErrors: { expires_at: "Avant la date d’émission" } };

    const { data: existing } = await supabase.from("staff_documents").select("id, file_public_id, file_resource_type").eq("staff_id", v.staff_id).eq("type_id", v.type_id).maybeSingle();
    const prev = existing as { id: string; file_public_id: string | null; file_resource_type: string | null } | null;

    // Justificatif facultatif : soit un fichier, soit un lien https (jamais les deux).
    const rawLink = String(formData.get("link") ?? "").trim();
    const link = rawLink ? parseLink(rawLink) : null;
    if (rawLink && !link) return { ok: false, error: "Lien invalide : utilisez une adresse https://", fieldErrors: { link: "Lien invalide : utilisez une adresse https://" } };
    const incoming = formData.get("file");
    if (link && incoming instanceof File && incoming.size > 0) return { ok: false, error: "Choisissez un fichier OU un lien, pas les deux.", fieldErrors: { link: "Fichier ou lien, pas les deux" } };

    // Fichier facultatif : taille et type réel vérifiés côté serveur.
    let uploaded: Awaited<ReturnType<typeof uploadPrivateFile>> | null = null;
    let fileName: string | null = null;
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      if (file.size > DOC_MAX_BYTES) return { ok: false, error: "Fichier trop volumineux (5 Mo maximum).", fieldErrors: { file: "5 Mo maximum" } };
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = detectDocumentType(bytes);
      if (!mime || !(mime in DOC_MIME)) return { ok: false, error: "Format non accepté : PDF, JPG, PNG ou WebP uniquement.", fieldErrors: { file: "PDF, JPG, PNG ou WebP" } };
      uploaded = await uploadPrivateFile(bytes, mime, `manecare/${user.id}/${v.staff_id}`);
      if (!uploaded.ok) return { ok: false, error: uploaded.error };
      fileName = file.name.replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, 120) || "document";
    }

    const row: Record<string, unknown> = { owner_id: user.id, staff_id: v.staff_id, type_id: v.type_id, expires_at: noExpiry ? null : v.expires_at, no_expiry: noExpiry, issued_at: v.issued_at, note: v.note, updated_at: new Date().toISOString() };
    if (link) Object.assign(row, { link_url: link, file_public_id: null, file_resource_type: null, file_format: null, file_name: null, file_bytes: null, file_uploaded_at: null });
    else if (uploaded?.ok) Object.assign(row, { link_url: null, file_public_id: uploaded.file.publicId, file_resource_type: uploaded.file.resourceType, file_format: uploaded.file.format, file_name: fileName, file_bytes: uploaded.file.bytes, file_uploaded_at: new Date().toISOString() });

    const { data: saved, error } = prev
      ? await supabase.from("staff_documents").update(row).eq("id", prev.id).select("id").single()
      : await supabase.from("staff_documents").insert(row).select("id").single();
    if (error || !saved) {
      if (uploaded?.ok) await deletePrivateFile(uploaded.file.publicId, uploaded.file.resourceType); // pas de fichier orphelin
      return { ok: false, error: "Enregistrement impossible. Réessayez." };
    }
    if ((uploaded?.ok || link) && prev?.file_public_id) await deletePrivateFile(prev.file_public_id, prev.file_resource_type ?? "image");

    await supabase.from("document_access_log").insert({ owner_id: user.id, staff_id: v.staff_id, document_id: (saved as { id: string }).id, action: uploaded?.ok ? (prev?.file_public_id ? "replace" : "upload") : "upload" });
    // Document déjà expiré ou bientôt expiré : notification immédiate dans l'application (avec bouton « Envoyer un rappel »).
    let alerted = false;
    if (!noExpiry && v.expires_at) {
      const st = staff as { full_name: string; email: string | null };
      alerted = (await raiseDocumentAlert(supabase, { ownerId: user.id, documentId: (saved as { id: string }).id, staffId: v.staff_id, staff: st, type, expiresOn: v.expires_at, autoEmail: false, company: profile.company_name || "Maneliza Care" })) === "notified"; // à l’enregistrement : notification + bouton « Envoyer un rappel », jamais d’envoi automatique
    }
    revalidate(v.staff_id);
    return { ok: true, message: alerted ? "Document enregistré — une notification a été créée (document expiré ou bientôt expiré)" : "Document enregistré" };
  });
}

export async function deleteStaffDocument(documentId: string): Promise<ActionResult> {
  return withSession(async ({ supabase, user }) => {
    if (!uuidSchema.safeParse(documentId).success) return { ok: false, error: "Requête invalide" };
    const { data } = await supabase.from("staff_documents").select("id, staff_id, file_public_id, file_resource_type, document_types(name_fr)").eq("id", documentId).maybeSingle();
    const d = data as unknown as { id: string; staff_id: string; file_public_id: string | null; file_resource_type: string | null; document_types: { name_fr: string } | { name_fr: string }[] | null } | null;
    if (!d) return { ok: false, error: "Document introuvable" };
    const { error } = await supabase.from("staff_documents").delete().eq("id", documentId);
    if (error) return { ok: false, error: "Suppression impossible." };
    if (d.file_public_id) await deletePrivateFile(d.file_public_id, d.file_resource_type ?? "image");
    await supabase.from("document_access_log").insert({ owner_id: user.id, staff_id: d.staff_id, document_id: null, action: "delete" });
    const tname = Array.isArray(d.document_types) ? d.document_types[0]?.name_fr : d.document_types?.name_fr;
    await logActivity(supabase, user.id, { event_type: "document_deleted", staff_id: d.staff_id, description: `Document « ${tname ?? "?"} » supprimé` });
    revalidate(d.staff_id);
    return { ok: true, message: "Document supprimé" };
  });
}

/** Envoie au staff un e-mail (FR + EN) pour un document expiré ou bientôt expiré, et le trace dans les notifications. */
export async function sendDocumentEmail(documentId: string, notificationId?: string): Promise<ActionResult> {
  return withSession(async ({ supabase, user, profile }) => {
    if (!uuidSchema.safeParse(documentId).success) return { ok: false, error: "Requête invalide" };
    if (!isEmailConfigured()) return { ok: false, error: "Le service d’e-mail n’est pas configuré (BREVO_SMTP_USER, BREVO_SMTP_KEY, EMAIL_FROM)." };
    const { data } = await supabase.from("staff_documents").select("id, staff_id, expires_at, no_expiry, document_types(name_fr, name_en), staff(full_name, email)").eq("id", documentId).maybeSingle();
    const d = data as unknown as { id: string; staff_id: string; expires_at: string | null; no_expiry: boolean; document_types: Pick<DocType, "name_fr" | "name_en"> | Pick<DocType, "name_fr" | "name_en">[]; staff: { full_name: string; email: string | null } | { full_name: string; email: string | null }[] } | null;
    if (!d) return { ok: false, error: "Document introuvable" };
    const type = Array.isArray(d.document_types) ? d.document_types[0] : d.document_types;
    const staff = Array.isArray(d.staff) ? d.staff[0] : d.staff;
    if (!type || !staff) return { ok: false, error: "Données liées introuvables" };
    if (!staff.email) return { ok: false, error: "Ce staff n’a pas d’adresse e-mail enregistrée.", fieldErrors: { email: "Adresse e-mail manquante" } };
    if (!d.expires_at || d.no_expiry) return { ok: false, error: "Ce document n’a pas de date d’expiration." };

    const mail = documentExpiryEmail({ staffName: staff.full_name, documentName: { fr: type.name_fr, en: type.name_en }, expiresOn: d.expires_at, daysLeft: daysUntil(d.expires_at, todayIso()), company: profile.company_name || "Maneliza Care" });
    const sent = await sendEmail({ to: staff.email, toName: staff.full_name, ...mail });
    if (!sent.ok) return { ok: false, error: "L’e-mail n’a pas pu être envoyé. Réessayez dans un instant." };

    const now = new Date().toISOString();
    if (notificationId && uuidSchema.safeParse(notificationId).success) await supabase.from("notifications").update({ email_sent_at: now, read_at: now }).eq("id", notificationId);
    await supabase.from("document_access_log").insert({ owner_id: user.id, staff_id: d.staff_id, document_id: d.id, action: "email_sent" });
    await logActivity(supabase, user.id, { event_type: "document_email_sent", staff_id: d.staff_id, description: `E-mail de rappel envoyé à ${staff.full_name} pour « ${type.name_fr} »` });
    await notify(supabase, user.id, { type: "document_email_sent", title: "Rappel envoyé", message: `Un rappel a été envoyé à ${staff.full_name} : le document « ${type.name_fr} » doit être renouvelé.`, link: `/staff/${d.staff_id}`, metadata: { document_id: d.id, staff_id: d.staff_id, staff_name: staff.full_name, doc_fr: type.name_fr, doc_en: type.name_en, expires_on: d.expires_at, emailed_to: staff.email, kind: "email_sent" } });
    revalidate(d.staff_id);
    return { ok: true, message: `Rappel envoyé à ${staff.full_name}` };
  });
}

/* ───────── Types de documents (obligatoires ou non), modifiables ───────── */
const typeSchema = z.object({
  name_fr: z.string().trim().min(1, "Nom requis").max(80), name_en: z.string().trim().min(1, "Nom requis").max(80),
  mandatory: z.boolean(), can_expire: z.boolean(),
});

export async function saveDocumentType(id: string | null, raw: unknown): Promise<ActionResult> {
  return withSession(async ({ supabase, user }) => {
    const p = typeSchema.safeParse(raw);
    if (!p.success) return { ok: false, error: "Formulaire invalide", fieldErrors: fieldErrorsFrom(p.error) };
    if (id) {
      if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Requête invalide" };
      const { error } = await supabase.from("document_types").update({ ...p.data, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) return { ok: false, error: "Modification impossible." };
    } else {
      const key = `custom_${Math.random().toString(36).slice(2, 10)}`;
      const { error } = await supabase.from("document_types").insert({ ...p.data, owner_id: user.id, key, sort_order: 200 });
      if (error) return { ok: false, error: "Création impossible." };
    }
    revalidatePath("/settings/documents"); revalidatePath("/staff");
    return { ok: true, message: "Type de document enregistré" };
  });
}

export async function archiveDocumentType(id: string, archived: boolean): Promise<ActionResult> {
  return withSession(async ({ supabase }) => {
    if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Requête invalide" };
    const { error } = await supabase.from("document_types").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id);
    if (error) return { ok: false, error: "Opération impossible." };
    revalidatePath("/settings/documents"); revalidatePath("/staff");
    return { ok: true, message: archived ? "Type archivé" : "Type réactivé" };
  });
}

