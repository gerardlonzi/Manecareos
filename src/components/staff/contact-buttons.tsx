"use client";
import { MessageCircle, Phone } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { usePreferences } from "@/components/providers/preferences-provider";
import { telHref, whatsappHref } from "@/lib/phone";
import { cn } from "@/lib/utils";

/** Ouvre l’application Téléphone / WhatsApp. L’appli ne sait pas si l’appel a abouti : « Marquer comme contacté » est une déclaration du manager. */
export function ContactButtons({ phone, size = "sm" }: { phone: string | null; size?: "sm" | "md" }) {
  const { t } = usePreferences();
  if (!phone) return <span className="text-xs text-muted">{t("Pas de numéro", "No number")}</span>;
  const cls = buttonVariants({ variant: "secondary", size });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={telHref(phone)} className={cls}><Phone className="h-4 w-4" aria-hidden /> {t("Appeler", "Call")}</a>
      <a href={whatsappHref(phone)} target="_blank" rel="noopener noreferrer" className={cn(cls)}><MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp</a>
      <CopyButton value={phone} label={t("Copier le numéro", "Copy number")} size={size} />
    </div>
  );
}
