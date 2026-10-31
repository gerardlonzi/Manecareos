"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, Link2, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteStaffDocument, saveStaffDocument, sendDocumentEmail } from "@/actions/documents";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/form";
import { daysUntil, docName, docStatus, todayIso, type DocType, type StaffDoc } from "@/lib/documents";
import { cn } from "@/lib/utils";

type Source = "none" | "file" | "link";

function DocRow({ staffId, type, doc, canEmail, hasEmail }: { staffId: string; type: DocType; doc?: StaffDoc; canEmail: boolean; hasEmail: boolean }) {
  const router = useRouter();
  const { t, tm, locale } = usePreferences();
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [expires, setExpires] = React.useState(doc?.expires_at ?? "");
  const [noExpiry, setNoExpiry] = React.useState(doc?.no_expiry ?? false);
  const [issued, setIssued] = React.useState(doc?.issued_at ?? "");
  const [source, setSource] = React.useState<Source>(doc?.link_url ? "link" : "none");
  const [link, setLink] = React.useState(doc?.link_url ?? "");
  const [file, setFile] = React.useState<File | null>(null);
  const [errs, setErrs] = React.useState<Record<string, string>>({});

  const status = doc ? docStatus(doc) : null;
  const days = doc?.expires_at && !doc.no_expiry ? daysUntil(doc.expires_at, todayIso()) : null;
  const hasProof = Boolean(doc?.file_public_id || doc?.link_url);

  const save = () => start(async () => {
    const fd = new FormData();
    fd.set("expires_at", noExpiry ? "" : expires);
    fd.set("no_expiry", noExpiry ? "true" : "false");
    fd.set("issued_at", issued);
    if (source === "file" && file) fd.set("file", file);
    if (source === "link") fd.set("link", link);
    const r = await saveStaffDocument(staffId, type.id, fd);
    if (!r.ok) { setErrs(r.fieldErrors ?? {}); toast.error(tm(r.error)); return; }
    setErrs({}); setFile(null); setOpen(false); toast.success(tm(r.message ?? "Enregistré")); router.refresh();
  });

  const badge = !doc
    ? (type.mandatory ? <Badge tone="red">{t("Manquant", "Missing")}</Badge> : <Badge tone="gray">{t("Non fourni", "Not provided")}</Badge>)
    : status === "expired" ? <Badge tone="red">{t("Expiré", "Expired")}</Badge>
    : status === "expiring" ? <Badge tone="amber">{t(`Expire dans ${days} j`, `Expires in ${days} d`)}</Badge>
    : <Badge tone="green">{doc.no_expiry ? t("Sans expiration", "No expiry") : t("Valide", "Valid")}</Badge>;

  return (
    <li className={cn("rounded-xl border p-3", !doc && type.mandatory ? "border-danger/30 bg-danger-soft/40" : status === "expired" ? "border-danger/30 bg-danger-soft/40" : "border-line bg-surface")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">{docName(type, locale)}{type.mandatory ? <span className="rounded bg-ink/5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">{t("Obligatoire", "Mandatory")}</span> : null}</p>
          <p className="mt-0.5 text-xs text-muted">
            {doc ? (doc.no_expiry ? t("Sans date d’expiration", "No expiry date") : `${t("Expire le", "Expires on")} ${doc.expires_at}`) : t("Aucun document enregistré", "No document recorded")}
            {doc?.file_name ? ` · ${doc.file_name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">{badge}</div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{doc ? t("Modifier", "Edit") : t("Ajouter", "Add")}</Button>
        {hasProof && doc ? <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium hover:bg-primary-soft">{doc.link_url ? <ExternalLink className="h-3.5 w-3.5" aria-hidden /> : <FileText className="h-3.5 w-3.5" aria-hidden />}{doc.link_url ? t("Ouvrir le lien", "Open link") : t("Voir le fichier", "View file")}</a> : null}
        {doc && canEmail && doc.expires_at && !doc.no_expiry && (status === "expired" || status === "expiring") ? (
          <Button size="sm" variant="secondary" disabled={!hasEmail} title={hasEmail ? undefined : t("Aucune adresse e-mail pour ce staff", "No email address for this staff member")} pending={pending}
            onClick={() => start(async () => { const r = await sendDocumentEmail(doc.id); if (!r.ok) toast.error(tm(r.error)); else toast.success(tm(r.message ?? "E-mail envoyé")); router.refresh(); })}><Mail className="h-3.5 w-3.5" aria-hidden />{t("Envoyer un rappel", "Send reminder")}</Button>
        ) : null}
        {doc ? <Button size="sm" variant="outlineDanger" onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" aria-hidden /><span className="sr-only">{t("Supprimer", "Delete")}</span></Button> : null}
      </div>

      {open ? (
        <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          {type.can_expire ? (
            <>
              <label className="text-xs font-medium">{t("Date d’expiration", "Expiry date")} <span className="text-danger">*</span>
                <Input type="date" value={noExpiry ? "" : expires} disabled={noExpiry} onChange={(e) => setExpires(e.target.value)} aria-invalid={!!errs.expires_at} className="mt-1" />
                {errs.expires_at ? <span className="text-danger">{tm(errs.expires_at)}</span> : null}
              </label>
              <label className="text-xs font-medium">{t("Date d’émission (facultatif)", "Issue date (optional)")}
                <Input type="date" value={issued} onChange={(e) => setIssued(e.target.value)} className="mt-1" />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={noExpiry} onChange={(e) => setNoExpiry(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />{t("Ce document n’a pas de date d’expiration", "This document has no expiry date")}</label>
            </>
          ) : null}

          <fieldset className="sm:col-span-2">
            <legend className="mb-1 text-xs font-medium">{t("Justificatif (facultatif)", "Proof (optional)")}</legend>
            <div className="flex flex-wrap gap-4 text-sm" role="radiogroup">
              {([["none", t("Aucun", "None")], ["file", t("Fichier", "File")], ["link", t("Lien", "Link")]] as [Source, string][]).map(([v, label]) => (
                <label key={v} className="flex items-center gap-1.5"><input type="radio" name={`src-${type.id}`} checked={source === v} onChange={() => setSource(v)} className="accent-[var(--color-primary)]" />{label}</label>
              ))}
            </div>
            {source === "file" ? (
              <div className="mt-2">
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium" />
                <p className="mt-1 text-xs text-muted">{t("PDF, JPG, PNG ou WebP — 5 Mo maximum. Stocké de façon privée et chiffrée en transit.", "PDF, JPG, PNG or WebP — 5 MB max. Stored privately, encrypted in transit.")}</p>
                {errs.file ? <p className="text-xs text-danger">{tm(errs.file)}</p> : null}
              </div>
            ) : null}
            {source === "link" ? (
              <div className="mt-2">
                <div className="relative"><Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden /><Input type="url" inputMode="url" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} aria-invalid={!!errs.link} className="pl-9" /></div>
                <p className="mt-1 text-xs text-muted">{t("Lien https vers le document (Drive, SharePoint…). Vérifiez que son accès est restreint.", "https link to the document (Drive, SharePoint…). Make sure its access is restricted.")}</p>
                {errs.link ? <p className="text-xs text-danger">{tm(errs.link)}</p> : null}
              </div>
            ) : null}
            {doc?.file_public_id && source === "none" ? <p className="mt-1 text-xs text-muted">{t("Le fichier actuel est conservé.", "The current file is kept.")}</p> : null}
          </fieldset>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t("Annuler", "Cancel")}</Button><Button size="sm" pending={pending} onClick={save}>{t("Enregistrer le document", "Save document")}</Button></div>
        </div>
      ) : null}

      <ConfirmDialog open={confirmDelete} destructive pending={pending} title={t("Supprimer ce document ?", "Delete this document?")}
        description={t("La date, le fichier ou le lien associé seront supprimés définitivement.", "The date and any attached file or link will be permanently deleted.")} confirmLabel={t("Supprimer", "Delete")}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => start(async () => { const r = await deleteStaffDocument(doc!.id); if (!r.ok) toast.error(tm(r.error)); else toast.success(tm(r.message ?? "Supprimé")); setConfirmDelete(false); router.refresh(); })} />
    </li>
  );
}

/** Documents du staff : date d'expiration obligatoire, justificatif (fichier OU lien) facultatif. */
export function DocumentsPanel({ staffId, types, docs, canEmail, hasEmail }: { staffId: string; types: DocType[]; docs: StaffDoc[]; canEmail: boolean; hasEmail: boolean }) {
  const byType = new Map(docs.map((d) => [d.type_id, d]));
  return <ul className="space-y-2.5">{types.map((ty) => <DocRow key={ty.id} staffId={staffId} type={ty} doc={byType.get(ty.id)} canEmail={canEmail} hasEmail={hasEmail} />)}</ul>;
}
