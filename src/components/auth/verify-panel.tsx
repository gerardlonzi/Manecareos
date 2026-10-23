"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resendConfirmation, verifyCode } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";

export function VerifyPanel({ email }: { email: string }) {
  const router = useRouter();
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
        Un message de confirmation a été envoyé à <strong className="text-ink">{email || "votre adresse"}</strong>. Cliquez sur le lien qu’il contient, ou saisissez le code à 6 chiffres s’il en comporte un.
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
            toast.success("Adresse confirmée");
            router.replace(r.data?.redirectTo ?? "/dashboard");
            router.refresh();
          });
        }}
      >
        <Field id="code" label="Code de vérification">
          <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
        </Field>
        <Button type="submit" className="w-full" pending={verifying} disabled={code.length < 6}>Vérifier le code</Button>
      </form>
      <Button
        variant="secondary" className="w-full" pending={resending} disabled={!email || cooldown > 0}
        onClick={() => startResend(async () => {
          const r = await resendConfirmation({ email });
          if (r.ok) { toast.success("Message renvoyé"); setCooldown(60); } else toast.error(r.error);
        })}
      >
        {cooldown > 0 ? `Renvoyer dans ${cooldown} s` : "Renvoyer le message"}
      </Button>
    </div>
  );
}
