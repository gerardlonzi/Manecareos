import * as React from "react";
import { cn } from "@/lib/utils";

export const controlClass =
  "w-full rounded-lg border border-line bg-surface text-sm text-ink placeholder:text-muted/70 transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(controlClass, "h-10 px-3", className)} {...p} />;
});
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(controlClass, "min-h-24 px-3 py-2", className)} {...p} />;
});
export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-ink", className)} {...p} />;
}

/** Libellé + contrôle + erreur/aide, correctement reliés pour l’accessibilité. */
export function Field({ id, label, error, hint, required, children, className }: { id: string; label: React.ReactNode; error?: string; hint?: React.ReactNode; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}{required ? <span className="text-danger" aria-hidden> *</span> : null}</Label>
      {children}
      {hint && !error ? <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p> : null}
      {error ? <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

/** Conteneur étroit et centré pour les formulaires (pas de champs étirés sur tout l’écran). */
export function FormPage({ children, width = "md", className }: { children: React.ReactNode; width?: "sm" | "md" | "lg"; className?: string }) {
  return <div className={cn("mx-auto w-full", width === "sm" ? "max-w-md" : width === "md" ? "max-w-2xl" : "max-w-3xl", className)}>{children}</div>;
}
