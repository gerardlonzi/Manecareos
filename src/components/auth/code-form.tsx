"use client";
import { friendlyError } from "@/lib/user-message";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { logout, resendLoginCode, submitLoginCode } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { OtpInput } from "@/components/auth/otp-input";
import { usePreferences } from "@/components/providers/preferences-provider";

/** Deuxième étape de connexion : code à 6 chiffres reçu par e-mail. */
export function CodeForm({ maskedEmail, next, alreadySent }: { maskedEmail: string; next?: string; alreadySent: boolean }) {
  const router = useRouter();
  const { t, tm } = usePreferences();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const [resending, startResend] = React.useTransition();
  const [cooldown, setCooldown] = React.useState(alreadySent ? 60 : 0);
  const sentOnce = React.useRef(false);

  const resend = React.useCallback((silent = false) => {
    setError(null);
    startResend(async () => {
      const r = await resendLoginCode();
      if (!r.ok) { setError(friendlyError(tm(r.error))); return; }
      setCooldown(60);
      if (!silent) toast.success(tm(r.message ?? "Nouveau code envoyé"));
    });
  }, [tm]);

  // Arrivée sans code déjà envoyé (ex. retour d’un lien de confirmation) : on en envoie un.
  React.useEffect(() => {
    if (alreadySent || sentOnce.current) return;
    sentOnce.current = true;
    resend(true);
  }, [alreadySent, resend]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const submit = (value: string) => {
    setError(null);
    start(async () => {
      const r = await submitLoginCode({ code: value, next });
      if (!r.ok) {
        setError(friendlyError(tm(r.fieldErrors?.code ?? r.error)));
        setCode("");
        if (/reconnect|Session expirée/i.test(r.error)) router.replace("/login");
        return;
      }
      toast.success(t("Connexion réussie", "Signed in successfully"));
      router.replace(r.data?.redirectTo ?? "/dashboard");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        {t("Nous avons envoyé un code à 6 chiffres à ", "We sent a 6-digit code to ")}<strong className="text-ink">{maskedEmail}</strong>{t(". Il expire dans 10 minutes.", ". It expires in 10 minutes.")}
      </p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form onSubmit={(e) => { e.preventDefault(); if (code.length === 6) submit(code); }} className="space-y-4">
        <OtpInput
          value={code} onChange={setCode} onComplete={submit} disabled={pending} autoFocus
          label={t("Code de vérification", "Verification code")}
        />
        <Button type="submit" className="w-full" pending={pending} disabled={code.length !== 6}>{t("Vérifier et se connecter", "Verify and sign in")}</Button>
      </form>
      <div className="flex items-center justify-between text-sm">
        <button type="button" disabled={cooldown > 0 || resending} onClick={() => resend()} className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline">
          {cooldown > 0 ? t(`Renvoyer le code (${cooldown} s)`, `Resend code (${cooldown}s)`) : t("Renvoyer le code", "Resend code")}
        </button>
        <form action={logout}><button type="submit" className="text-muted hover:text-ink hover:underline">{t("Annuler", "Cancel")}</button></form>
      </div>
      <p className="text-xs text-muted">{t("Vérifiez aussi vos courriers indésirables. Ne communiquez jamais ce code.", "Also check your spam folder. Never share this code.")}</p>
    </div>
  );
}
