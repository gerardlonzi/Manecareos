import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Deux colonnes « collantes » (écrans larges) : chaque colonne reste en place et ne défile que lorsque la souris
 * la survole. Sur mobile, les colonnes s'empilent et la page défile normalement.
 */
const colClass = "min-w-0 space-y-5 lg:sticky lg:top-[calc(var(--app-header-h)+var(--sticky-h,0px)+0.75rem)] lg:max-h-[calc(100dvh-var(--app-header-h)-var(--sticky-h,0px)-5.5rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:pr-1 scroll-thin";

export function TwoColumn({ left, right, className }: { left: React.ReactNode; right: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-5 lg:grid-cols-2", className)}>
      <div className={colClass}>{left}</div>
      <div className={colClass}>{right}</div>
    </div>
  );
}
