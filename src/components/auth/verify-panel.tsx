"use client";
import { friendlyError } from "@/lib/user-message";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resendConfirmation, verifyCode } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { OtpInput } from "@/components/auth/otp-input";
import { usePreferences } from "@/components/providers/preferences-provider";

/** Confirmation de l'adresse e-mail après inscription : code à 6 chiffres envoyé par Supabase. */
export function VerifyPanel({ email }: { email: string }) {
  const router = useRouter();
  const { t, tm } = usePreferences();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [verifying, startVerify] = React.useTransition();
  const [resending, startResend] = React.useTransition();
  const [cooldown, setCooldown] = React.useState(60);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const submit = (value: string) => {
    setError(null);
    startVerify(async () => {
      const r = await verifyCode({ email, code: value });
      if (!r.ok) { setError(friendlyError(tm(r.fieldErrors?.code ?? r.error))); setCode(""); return; }
      toast.success(t("Adresse confirmée", "Email verified"));
      router.replace(r.data?.redirectTo ?? "/dashboard");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        {t("Nous avons envoyé un code à 6 chiffres à ", "We sent a 6-digit code to ")}<strong className="text-ink">{email || t("votre adresse", "your email address")}</strong>{t(". Il expire dans 1 heure.", ". It expires in 1 hour.")}
      </p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form onSubmit={(e) => { e.preventDefault(); if (code.length === 6) submit(code); }} className="space-y-4">
        <OtpInput value={code} onChange={setCode} onComplete={submit} disabled={verifying} autoFocus label={t("Code de vérification", "Verification code")} />
        <Button type="submit" className="w-full" pending={verifying} disabled={code.length !== 6}>{t("Vérifier et continuer", "Verify and continue")}</Button>
      </form>
      <button
        type="button" disabled={!email || cooldown > 0 || resending}
        onClick={() => startResend(async () => {
          const r = await resendConfirmation({ email });
          if (r.ok) { toast.success(t("Nouveau code envoyé", "New code sent")); setCooldown(60); } else toast.error(friendlyError(tm(r.error)));
        })}
        className="text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
      >
        {cooldown > 0 ? t(`Renvoyer le code (${cooldown} s)`, `Resend code (${cooldown}s)`) : t("Renvoyer le code", "Resend code")}
      </button>
      <p className="text-xs text-muted">{t("Vérifiez aussi vos courriers indésirables. Ne communiquez jamais ce code.", "Also check your spam folder. Never share this code.")}</p>
    </div>
  );
}
