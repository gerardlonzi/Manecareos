import { MessageCircle, Phone } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { telHref, whatsappHref } from "@/lib/phone";
import { cn } from "@/lib/utils";

/**
 * Ouvre l’application Téléphone / WhatsApp avec le numéro E.164. L’application ne sait pas si l’appel ou le message a abouti
 * et ne le prétend jamais : « Marquer comme contacté » est une déclaration du manager.
 */
export function ContactButtons({ phone, size = "sm" }: { phone: string | null; size?: "sm" | "md" }) {
  if (!phone) return <span className="text-xs text-muted">Pas de numéro</span>;
  const cls = buttonVariants({ variant: "secondary", size });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={telHref(phone)} className={cls}><Phone className="h-4 w-4" aria-hidden /> Appeler</a>
      <a href={whatsappHref(phone)} target="_blank" rel="noopener noreferrer" className={cn(cls)}><MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp</a>
      <CopyButton value={phone} label="Copier le numéro" size={size} />
    </div>
  );
}
