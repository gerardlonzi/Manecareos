"use client";
import { friendlyError } from "@/lib/user-message";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { signup } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { Alert } from "@/components/ui/card";
import { COUNTRY_LIST, countryName } from "@/config/countries";
import { PasswordInput } from "./password-input";
import { usePreferences } from "@/components/providers/preferences-provider";

const schema = z
  .object({
    full_name: z.string().trim().min(2, "Nom trop court"),
    email: z.email("Adresse e-mail invalide"),
    password: z.string().min(10, "10 caractères minimum").regex(/[A-Za-z]/, "Ajoutez une lettre").regex(/\d/, "Ajoutez un chiffre"),
    confirm: z.string(),
    company_name: z.string().optional(),
    country_code: z.string().min(2, "Choisissez un pays"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Les mots de passe ne correspondent pas" });
type Values = z.infer<typeof schema>;

export function SignupForm({ defaultCountry }: { defaultCountry: string }) {
  const router = useRouter();
  const { t, tm, locale } = usePreferences();
  const [pending, start] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);
  const { register, handleSubmit, setError, setValue, watch, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { country_code: defaultCountry } });
  const countryValue = watch("country_code");

  const onSubmit = (v: Values) => {
    setFormError(null);
    start(async () => {
      const r = await signup(v);
      if (!r.ok) {
        setFormError(friendlyError(r.error));
        for (const [k, m] of Object.entries(r.fieldErrors ?? {})) if (k in v) setError(k as keyof Values, { message: m });
        return;
      }
      toast.success(t("Compte créé", "Account created"));
      router.replace(r.data?.redirectTo ?? "/dashboard");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field id="full_name" label={t("Nom complet", "Full name")} error={errors.full_name?.message ? tm(errors.full_name.message) : undefined} required>
        <Input id="full_name" autoComplete="name" aria-invalid={!!errors.full_name} {...register("full_name")} />
      </Field>
      <Field id="email" label={t("Adresse e-mail", "Email address")} error={errors.email?.message ? tm(errors.email.message) : undefined} required>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="company_name" label={t("Entreprise (facultatif)", "Company (optional)")}>
          <Input id="company_name" autoComplete="organization" {...register("company_name")} />
        </Field>
        <Field id="country_code" label={t("Pays d’activité", "Country of operation")} error={errors.country_code?.message ? tm(errors.country_code.message) : undefined} required>
          <input type="hidden" {...register("country_code")} />
          <SearchablePicker id="country_code" value={countryValue} options={COUNTRY_LIST.map((c) => ({ value: c.code, label: countryName(c.code, locale), description: `+${c.dialCode}` }))} onValueChange={(value) => setValue("country_code", value, { shouldDirty: true, shouldValidate: true })} searchPlaceholder={t("Rechercher un pays…", "Search country…")} />
        </Field>
      </div>
      <Field id="password" label={t("Mot de passe", "Password")} error={errors.password?.message ? tm(errors.password.message) : undefined} hint={t("10 caractères minimum, avec lettres et chiffres.", "At least 10 characters, including letters and numbers.")} required>
        <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
      </Field>
      <Field id="confirm" label={t("Confirmer le mot de passe", "Confirm password")} error={errors.confirm?.message ? tm(errors.confirm.message) : undefined} required>
        <PasswordInput id="confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register("confirm")} />
      </Field>
      <Button type="submit" className="w-full" pending={pending}>{t("Créer mon compte", "Create account")}</Button>
    </form>
  );
}
