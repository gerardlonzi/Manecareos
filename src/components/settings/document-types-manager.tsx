"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { archiveDocumentType, saveDocumentType } from "@/actions/documents";
import { setAutoEmailDocuments } from "@/actions/settings";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { docName, type DocType } from "@/lib/documents";

export function DocumentTypesManager({ types, autoEmail, emailConfigured }: { types: DocType[]; autoEmail: boolean; emailConfigured: boolean }) {
  const router = useRouter();
  const { t, tm, locale } = usePreferences();
  const [pending, start] = React.useTransition();
  const [fr, setFr] = React.useState(""); const [en, setEn] = React.useState("");
  const [mandatory, setMandatory] = React.useState(true); const [canExpire, setCanExpire] = React.useState(true);
  const [errs, setErrs] = React.useState<Record<string, string>>({});

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> }>, after?: () => void) => start(async () => {
    const r = await fn();
    if (!r.ok) { setErrs(r.fieldErrors ?? {}); toast.error(tm(r.error)); return; }
    setErrs({}); after?.(); toast.success(tm(r.message ?? "Enregistré")); router.refresh();
  });
  const active = types.filter((x) => !x.archived_at), archived = types.filter((x) => x.archived_at);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title={t("Documents demandés au staff", "Documents required from staff")} description={t("Un staff dont un document obligatoire manque ou a expiré ne peut pas être attribué à une mission.", "A staff member with a missing or expired mandatory document cannot be assigned to an assignment.")} />
        <CardBody>
          <ul className="divide-y divide-line">
            {active.map((ty) => (
              <li key={ty.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0"><p className="text-sm font-medium">{docName(ty, locale)}</p><p className="text-xs text-muted">{ty.can_expire ? t("Avec date d’expiration", "With expiry date") : t("Sans expiration", "No expiry")}</p></div>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={pending} onClick={() => run(() => saveDocumentType(ty.id, { name_fr: ty.name_fr, name_en: ty.name_en, mandatory: !ty.mandatory, can_expire: ty.can_expire }))} aria-pressed={ty.mandatory} title={t("Basculer obligatoire / facultatif", "Toggle mandatory / optional")}>
                    <Badge tone={ty.mandatory ? "red" : "gray"}>{ty.mandatory ? t("Obligatoire", "Mandatory") : t("Facultatif", "Optional")}</Badge>
                  </button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => archiveDocumentType(ty.id, true))}>{t("Archiver", "Archive")}</Button>
                </div>
              </li>
            ))}
          </ul>
          {archived.length ? (
            <details className="mt-4 text-sm"><summary className="cursor-pointer text-muted">{t(`${archived.length} type(s) archivé(s)`, `${archived.length} archived type(s)`)}</summary>
              <ul className="mt-2 divide-y divide-line">{archived.map((ty) => <li key={ty.id} className="flex items-center justify-between py-2"><span>{docName(ty, locale)}</span><Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => archiveDocumentType(ty.id, false))}>{t("Réactiver", "Restore")}</Button></li>)}</ul></details>
          ) : null}
        </CardBody>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title={t("Ajouter un document", "Add a document")} description={t("Ex. : Care Certificate, Moving & Handling, Premiers secours…", "E.g. Care Certificate, Moving & Handling, First aid…")} />
          <CardBody className="space-y-3">
            <Field id="dt-fr" label={t("Nom en français", "Name in French")} error={errs.name_fr ? tm(errs.name_fr) : undefined}><Input id="dt-fr" value={fr} onChange={(e) => setFr(e.target.value)} maxLength={80} /></Field>
            <Field id="dt-en" label={t("Nom en anglais", "Name in English")} error={errs.name_en ? tm(errs.name_en) : undefined}><Input id="dt-en" value={en} onChange={(e) => setEn(e.target.value)} maxLength={80} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />{t("Obligatoire pour être attribué à une mission", "Mandatory to be assigned to an assignment")}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={canExpire} onChange={(e) => setCanExpire(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />{t("Ce document a une date d’expiration", "This document has an expiry date")}</label>
            <div className="flex justify-end"><Button pending={pending} onClick={() => run(() => saveDocumentType(null, { name_fr: fr || en, name_en: en || fr, mandatory, can_expire: canExpire }), () => { setFr(""); setEn(""); })}><Plus className="h-4 w-4" aria-hidden />{t("Ajouter", "Add")}</Button></div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("Rappels d’expiration par e-mail", "Expiry reminders by email")} description={t("Chaque jour, la plateforme repère les documents qui expirent (60, 30, 14, 7 jours avant, puis à l’échéance) et crée une notification.", "Every day the platform spots expiring documents (60, 30, 14, 7 days before, then on the due date) and creates a notification.")} />
          <CardBody className="space-y-3">
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={autoEmail} disabled={pending} onChange={(e) => run(() => setAutoEmailDocuments(e.target.checked))} className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" /><span><strong>{t("Envoyer automatiquement un e-mail au staff", "Automatically email the staff member")}</strong><span className="block text-xs text-muted">{t("Le message est bilingue (FR + EN). La notification indique qu’un e-mail a été envoyé et pourquoi.", "The message is bilingual (FR + EN). The notification shows that an email was sent and why.")}</span></span></label>
            {!emailConfigured ? <Alert tone="warning">{t("Service d’e-mail non configuré : ajoutez BREVO_API_KEY et EMAIL_FROM. Sans cela, seules les notifications sont créées.", "Email service not configured: add BREVO_API_KEY and EMAIL_FROM. Without it, only notifications are created.")}</Alert> : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
