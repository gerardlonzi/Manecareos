"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "./button";
import { usePreferences } from "@/components/providers/preferences-provider";

/** Relit les données serveur de la page courante. */
export function RefreshButton({ label, variant = "secondary" }: { label?: string; variant?: "secondary" | "ghost" }) {
  const router = useRouter();
  const { t } = usePreferences();
  const [pending, start] = React.useTransition();
  const text = label ?? t("Actualiser", "Refresh");
  return (
    <Button variant={variant} size="icon" onClick={() => start(() => router.refresh())} aria-label={text} title={text}>
      <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
    </Button>
  );
}
