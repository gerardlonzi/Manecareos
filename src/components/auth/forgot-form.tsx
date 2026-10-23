"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { forgotPassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";

const schema = z.object({ email: z.email("Adresse e-mail invalide") });

export function ForgotForm() {
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return (
    <form
      onSubmit={handleSubmit((v) => start(async () => {
        const r = await forgotPassword(v);
        setResult(r.ok ? { ok: true, text: r.message ?? "Message envoyé." } : { ok: false, text: r.error });
      }))}
      className="space-y-4" noValidate
    >
      {result ? <Alert tone={result.ok ? "success" : "danger"}>{result.text}</Alert> : null}
      <Field id="email" label="Adresse e-mail" error={errors.email?.message} required>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
      </Field>
      <Button type="submit" className="w-full" pending={pending}>Envoyer le lien</Button>
    </form>
  );
}
