"use client";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./button";

export function CopyButton({ value, label = "Copier", size = "sm" }: { value: string; label?: string; size?: "sm" | "md" }) {
  return (
    <Button
      variant="secondary"
      size={size}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success("Copié dans le presse-papiers");
        } catch {
          toast.error("Copie impossible : autorisez l’accès au presse-papiers.");
        }
      }}
    >
      <Copy className="h-4 w-4" aria-hidden /> {label}
    </Button>
  );
}
