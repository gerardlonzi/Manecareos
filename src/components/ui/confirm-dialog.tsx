"use client";
import * as React from "react";
import { Button } from "./button";

type Props = {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
};

/** Boîte de dialogue native <dialog> : focus piégé, Échap et accessibilité gérés par le navigateur. */
export function ConfirmDialog({ open, title, description, confirmLabel = "Confirmer", cancelLabel = "Annuler", destructive, pending, onConfirm, onCancel, children }: Props) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); if (!pending) onCancel(); }}
      onClose={() => { if (open) onCancel(); }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(92vw,28rem)] rounded-xl border border-line bg-surface p-0 text-ink shadow-xl"
    >
      <div className="p-5">
        <h2 id="confirm-title" className="text-base font-semibold">{title}</h2>
        {description ? <div className="mt-2 text-sm text-muted">{description}</div> : null}
        {children}
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-bg px-5 py-3">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>{cancelLabel}</Button>
        <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} pending={pending}>{confirmLabel}</Button>
      </div>
    </dialog>
  );
}
