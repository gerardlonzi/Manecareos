"use client";
import { friendlyError } from "@/lib/user-message";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";
import { usePreferences } from "@/components/providers/preferences-provider";
import { PasswordInput } from "./password-input";

const schema = z.object({ email: z.email("Adresse e-mail invalide"), password: z.string().min(1, "Mot de passe requis") });
type Values = z.infer<typeof schema>;

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const { t } = usePreferences();
  const [pending, start] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = (v: Values) => {
    setFormError(null);
    start(async () => {
      const r = await login({ ...v, next });
      if (!r.ok) {
        setFormError(friendlyError(r.error));
        for (const [k, m] of Object.entries(r.fieldErrors ?? {})) if (k === "email" || k === "password") setError(k, { message: m });
        return;
      }
      toast.success(t("Connexion réussie", "Signed in successfully"));
      router.replace(r.data?.redirectTo ?? "/dashboard");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field id="email" label={t("Adresse e-mail", "Email address")} error={errors.email?.message} required>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} {...register("email")} />
      </Field>
      <Field id="password" label={t("Mot de passe", "Password")} error={errors.password?.message} required>
        <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register("password")} />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">{t("Mot de passe oublié ?", "Forgot password?")}</Link>
      </div>
      <Button type="submit" className="w-full" pending={pending}>{t("Se connecter", "Log in")}</Button>
    </form>
  );
}
