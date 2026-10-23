"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "./button";

/** Relit les données serveur de la page courante. */
export function RefreshButton({ label = "Actualiser", variant = "secondary" }: { label?: string; variant?: "secondary" | "ghost" }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button variant={variant} pending={pending} onClick={() => start(() => router.refresh())}>
      {!pending ? <RefreshCw className="h-4 w-4" aria-hidden /> : null} {label}
    </Button>
  );
}
