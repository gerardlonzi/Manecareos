"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export type MenuItem = { label: React.ReactNode; onSelect: () => void; icon?: React.ReactNode; disabled?: boolean; danger?: boolean; hint?: string };

/** Bouton + menu d’actions (clavier : Échap pour fermer). */
export function DropdownMenu({ label, icon, items, variant = "secondary", size = "md", pending, disabled, align = "right" }: { label: React.ReactNode; icon?: React.ReactNode; items: MenuItem[]; variant?: "secondary" | "primary" | "ghost"; size?: "sm" | "md"; pending?: boolean; disabled?: boolean; align?: "left" | "right" }) {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", out); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", out); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <Button variant={variant} size={size} pending={pending} disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {icon}{label}<ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
      </Button>
      {open ? (
        <div role="menu" className={cn("anim-pop absolute z-50 mt-1 min-w-56 rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-pop)]", align === "right" ? "right-0" : "left-0")}>
          {items.map((it, i) => (
            <button key={i} role="menuitem" type="button" disabled={it.disabled} onClick={() => { setOpen(false); it.onSelect(); }}
              className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-primary-soft disabled:pointer-events-none disabled:opacity-45", it.danger && "text-danger hover:bg-danger-soft")}>
              {it.icon}<span className="flex-1">{it.label}</span>{it.hint ? <span className="text-xs text-muted">{it.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
