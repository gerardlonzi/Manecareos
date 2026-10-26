"use client";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./button";
import { usePreferences } from "@/components/providers/preferences-provider";

export function CopyButton({ value, label, size = "sm" }: { value: string; label?: string; size?: "sm" | "md" }) {
  const { t } = usePreferences();
  return (
    <Button variant="secondary" size={size} onClick={async () => {
      try { await navigator.clipboard.writeText(value); toast.success(t("Copié dans le presse-papiers", "Copied to clipboard")); }
      catch { toast.error(t("Copie impossible : autorisez l’accès au presse-papiers.", "Copy failed: allow clipboard access.")); }
    }}>
      <Copy className="h-4 w-4" aria-hidden /> {label ?? t("Copier", "Copy")}
    </Button>
  );
}
