"use client";
import { friendlyError } from "@/lib/user-message";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resendConfirmation, verifyCode } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";
import { usePreferences } from "@/components/providers/preferences-provider";

export function VerifyPanel({ email }: { email: string }) {
  const router = useRouter();
  const { t } = usePreferences();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [verifying, startVerify] = React.useTransition();
  const [resending, startResend] = React.useTransition();
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        {t("Un message de confirmation a été envoyé à ", "A confirmation email was sent to ")}<strong className="text-ink">{email || t("votre adresse", "your email address")}</strong>{t(". Cliquez sur le lien qu’il contient, ou saisissez le code à 6 chiffres s’il en comporte un.", ". Click the link in the email or enter the 6-digit code if provided.")}
      </p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startVerify(async () => {
            const r = await verifyCode({ email, code });
            if (!r.ok) { setError(r.fieldErrors?.code ?? r.error); return; }
            toast.success(t("Adresse confirmée", "Email verified"));
            router.replace(r.data?.redirectTo ?? "/dashboard");
            router.refresh();
          });
        }}
      >
        <Field id="code" label={t("Code de vérification", "Verification code")}>
          <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
        </Field>
        <Button type="submit" className="w-full" pending={verifying} disabled={code.length < 6}>{t("Vérifier le code", "Verify code")}</Button>
      </form>
      <Button
        variant="secondary" className="w-full" pending={resending} disabled={!email || cooldown > 0}
        onClick={() => startResend(async () => {
          const r = await resendConfirmation({ email });
          if (r.ok) { toast.success(t("Message renvoyé", "Email resent")); setCooldown(60); } else toast.error(friendlyError(r.error));
        })}
      >
        {cooldown > 0 ? `Renvoyer dans ${cooldown} s` : t("Renvoyer le message", "Resend email")}
      </Button>
    </div>
  );
}
