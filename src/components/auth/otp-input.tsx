"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Saisie d'un code en petits carrés : avance seule, accepte le collage, Retour arrière et flèches. */
export function OtpInput({ value, onChange, onComplete, length = 6, disabled, autoFocus, label }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void;
  length?: number; disabled?: boolean; autoFocus?: boolean; label: string;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const focus = (i: number) => { const el = refs.current[Math.max(0, Math.min(length - 1, i))]; el?.focus(); el?.select(); };
  const commit = (next: string, focusAt: number) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean); else focus(focusAt);
  };

  return (
    <div role="group" aria-label={label} className="flex justify-between gap-2 sm:gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`${label} ${i + 1}/${length}`}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (!v) { commit(value.slice(0, i) + value.slice(i + 1), i); return; }
            // Plusieurs chiffres d'un coup (saisie automatique du téléphone) : on les répartit.
            commit(value.slice(0, i) + v + value.slice(i + 1), i + v.length);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) { e.preventDefault(); commit(value.slice(0, i - 1) + value.slice(i), i - 1); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); focus(i - 1); }
            else if (e.key === "ArrowRight") { e.preventDefault(); focus(i + 1); }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text").replace(/\D/g, "");
            if (!text) return;
            e.preventDefault();
            commit(text, text.length);
          }}
          className={cn(
            "h-14 w-full min-w-0 rounded-xl border bg-surface text-center font-mono text-2xl font-semibold text-ink transition",
            "focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:opacity-50",
            d ? "border-primary/60" : "border-line",
          )}
        />
      ))}
    </div>
  );
}
