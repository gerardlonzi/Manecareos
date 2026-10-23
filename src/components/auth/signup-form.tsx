"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { signup } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";
import { COUNTRY_LIST } from "@/config/countries";
import { PasswordInput } from "./password-input";

const schema = z
  .object({
    full_name: z.string().trim().min(2, "Nom trop court"),
    email: z.email("Adresse e-mail invalide"),
    password: z.string().min(8, "8 caractères minimum").regex(/[A-Za-z]/, "Ajoutez une lettre").regex(/\d/, "Ajoutez un chiffre"),
    confirm: z.string(),
    company_name: z.string().optional(),
    country_code: z.string().min(2, "Choisissez un pays"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Les mots de passe ne correspondent pas" });
type Values = z.infer<typeof schema>;

export function SignupForm({ defaultCountry }: { defaultCountry: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { country_code: defaultCountry } });

  const onSubmit = (v: Values) => {
    setFormError(null);
    start(async () => {
      const r = await signup(v);
      if (!r.ok) {
        setFormError(r.error);
        for (const [k, m] of Object.entries(r.fieldErrors ?? {})) if (k in v) setError(k as keyof Values, { message: m });
        return;
      }
      toast.success("Compte créé");
      router.replace(r.data?.redirectTo ?? "/dashboard");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field id="full_name" label="Nom complet" error={errors.full_name?.message} required>
        <Input id="full_name" autoComplete="name" aria-invalid={!!errors.full_name} {...register("full_name")} />
      </Field>
      <Field id="email" label="Adresse e-mail" error={errors.email?.message} required>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="company_name" label="Entreprise (facultatif)">
          <Input id="company_name" autoComplete="organization" {...register("company_name")} />
        </Field>
        <Field id="country_code" label="Pays d’activité" error={errors.country_code?.message} required>
          <Select id="country_code" {...register("country_code")}>
            {COUNTRY_LIST.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field id="password" label="Mot de passe" error={errors.password?.message} hint="8 caractères minimum, avec lettres et chiffres." required>
        <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
      </Field>
      <Field id="confirm" label="Confirmer le mot de passe" error={errors.confirm?.message} required>
        <PasswordInput id="confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register("confirm")} />
      </Field>
      <Button type="submit" className="w-full" pending={pending}>Créer mon compte</Button>
    </form>
  );
}
