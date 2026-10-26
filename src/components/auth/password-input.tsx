"use client";
import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/form";

export const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function PasswordInput(props, ref) {
  const [shown, setShown] = React.useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={shown ? "text" : "password"} className="pr-10" {...props} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"
        aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={shown}
      >
        {shown ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}); 
