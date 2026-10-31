"use client";
import * as React from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Badge } from "@/components/ui/badge";
import { docName, type Compliance } from "@/lib/documents";
import { cn } from "@/lib/utils";

/** Texte détaillé de ce qui manque / expire (info-bulle et lecteurs d'écran). */
export function complianceDetails(c: Compliance, locale: "fr" | "en"): string[] {
  const fr = locale === "fr";
  const out: string[] = [];
  if (c.missing.length) out.push(`${fr ? "Manquant" : "Missing"} : ${c.missing.map((t) => docName(t, locale)).join(", ")}`);
  if (c.expired.length) out.push(`${fr ? "Expiré" : "Expired"} : ${c.expired.map((e) => `${docName(e.type, locale)} (${e.doc.expires_at})`).join(", ")}`);
  if (c.expiring.length) out.push(`${fr ? "Expire bientôt" : "Expiring soon"} : ${c.expiring.map((e) => `${docName(e.type, locale)} (${fr ? `${e.daysLeft} j` : `${e.daysLeft} d`})`).join(", ")}`);
  return out;
}

/** Info-bulle riche (survol ou focus clavier) listant ce qui manque ou expire. */
export function ComplianceTip({ compliance, children }: { compliance: Compliance; children: React.ReactNode }) {
  const { t, locale } = usePreferences();
  const details = complianceDetails(compliance, locale);
  return (
    <span className="group/tip relative inline-flex" tabIndex={0}>
      {children}
      <span role="tooltip" className="pointer-events-none invisible absolute left-0 top-full z-50 mt-1.5 w-72 max-w-[80vw] whitespace-normal rounded-lg border border-line bg-surface p-3 text-left text-xs font-normal leading-5 text-ink opacity-0 shadow-[var(--shadow-pop)] transition-opacity group-hover/tip:visible group-hover/tip:opacity-100 group-focus/tip:visible group-focus/tip:opacity-100">
        <strong className="mb-1 block text-[11px] uppercase tracking-wide text-muted">{t("Dossier de conformité", "Compliance file")}</strong>
        {details.length ? <ul className="list-disc space-y-0.5 pl-4">{details.map((d) => <li key={d}>{d}</li>)}</ul> : <span>{t("Complet et à jour.", "Complete and up to date.")}</span>}
        {!compliance.complete ? <span className="mt-1.5 block font-medium text-danger">{t("Ne peut pas être attribué à une mission.", "Cannot be assigned to an assignment.")}</span> : null}
      </span>
    </span>
  );
}

/** Pastille de conformité du dossier : texte + icône (jamais la couleur seule). */
export function ComplianceBadge({ compliance, className, tip = true }: { compliance: Compliance; className?: string; tip?: boolean }) {
  const { t } = usePreferences();
  if (compliance.requiredCount === 0) return null;
  const badge = compliance.level === "compliant" ? <Badge tone="green" className={className}><CheckCircle2 className="h-3 w-3" aria-hidden />{t("Dossier complet", "File complete")}</Badge>
    : compliance.level === "expiring" ? <Badge tone="amber" className={className}><AlertTriangle className="h-3 w-3" aria-hidden />{t("Expire bientôt", "Expiring soon")}</Badge>
    : <Badge tone="red" className={cn(className)}><ShieldAlert className="h-3 w-3" aria-hidden />{compliance.expired.length && !compliance.missing.length ? t("Document expiré", "Document expired") : t("Dossier incomplet", "File incomplete")}</Badge>;
  return tip ? <ComplianceTip compliance={compliance}>{badge}</ComplianceTip> : badge;
}
