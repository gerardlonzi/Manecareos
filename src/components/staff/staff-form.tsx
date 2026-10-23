"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { saveStaff } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { Card, CardBody, Alert } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LocationFields } from "@/components/location/location-fields";
import { useUnsavedWarning } from "@/components/use-unsaved-warning";
import { AVAILABILITY_LABELS } from "@/config/app";
import type { LocationStatus, Staff } from "@/lib/types";

const schema = z.object({
  full_name: z.string().trim().min(1, "Le nom est obligatoire").max(200),
  staff_code: z.string().max(50),
  phone: z.string().max(32),
  email: z.string().max(254).refine((v) => !v.trim() || z.email().safeParse(v.trim()).success, "Adresse e-mail invalide"),
  country_code: z.string().length(2, "Choisissez un pays"),
  postal_code: z.string().max(16),
  city: z.string().max(120),
  region: z.string().max(120),
  skills: z.string().max(1000),
  availability_status: z.enum(["available", "unavailable", "unknown"]),
  notes: z.string().max(4000),
});
type Values = z.infer<typeof schema>;

const empty = (country: string): Values => ({ full_name: "", staff_code: "", phone: "", email: "", country_code: country, postal_code: "", city: "", region: "", skills: "", availability_status: "unknown", notes: "" });

export function StaffForm({ staff, defaultCountry, timeZone }: { staff?: Staff; defaultCountry: string; timeZone: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const submitting = React.useRef(false);

  const initial: Values = staff
    ? {
        full_name: staff.full_name, staff_code: staff.staff_code ?? "", phone: staff.phone ?? "", email: staff.email ?? "",
        country_code: staff.country_code, postal_code: staff.postal_code ?? "", city: staff.city ?? "", region: staff.region ?? "",
        skills: staff.skills.join(", "), availability_status: staff.availability_status, notes: staff.notes ?? "",
      }
    : empty(defaultCountry);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  const { register, handleSubmit, setError, reset, formState: { errors, isDirty } } = form;
  useUnsavedWarning(isDirty && !pending);

  const submit = (another: boolean) =>
    handleSubmit((values) => {
      if (submitting.current) return; // évite les doubles soumissions
      submitting.current = true;
      setFormError(null);
      start(async () => {
        const r = await saveStaff(values, staff?.id);
        submitting.current = false;
        if (!r.ok) {
          setFormError(r.error);
          // Les données saisies sont conservées : le formulaire n’est pas réinitialisé en cas d’erreur.
          for (const [k, m] of Object.entries(r.fieldErrors ?? {})) if (k in values) setError(k as keyof Values, { message: m });
          toast.error(r.error);
          return;
        }
        toast.success(r.message ?? "Enregistré");
        reset(values);
        if (another && !staff) {
          reset(empty(values.country_code));
          router.refresh();
          return;
        }
        router.push(`/staff/${r.data?.id}`);
        router.refresh();
      });
    });

  const cancel = () => (isDirty ? setConfirmCancel(true) : router.back());

  return (
    <FormProvider {...form}>
      <form onSubmit={(e) => void submit(false)(e)} className="space-y-6" noValidate>
        {formError ? <Alert tone="danger">{formError}</Alert> : null}

        <Card>
          <CardBody className="space-y-4">
            <h2 className="text-sm font-semibold">Identité et contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="full_name" label="Nom complet" error={errors.full_name?.message} required className="sm:col-span-2">
                <Input id="full_name" autoComplete="off" aria-invalid={!!errors.full_name} {...register("full_name")} />
              </Field>
              <Field id="staff_code" label="Code staff" error={errors.staff_code?.message} hint="Facultatif, unique dans votre compte.">
                <Input id="staff_code" autoComplete="off" {...register("staff_code")} />
              </Field>
              <Field id="availability_status" label="Disponibilité" error={errors.availability_status?.message} hint="« Inconnue » n’est jamais comptée comme disponible.">
                <Select id="availability_status" {...register("availability_status")}>
                  {(Object.keys(AVAILABILITY_LABELS) as (keyof typeof AVAILABILITY_LABELS)[]).map((k) => <option key={k} value={k}>{AVAILABILITY_LABELS[k]}</option>)}
                </Select>
              </Field>
              <Field id="phone" label="Téléphone" error={errors.phone?.message} hint="Format national ou international (+…).">
                <Input id="phone" type="tel" autoComplete="off" aria-invalid={!!errors.phone} {...register("phone")} />
              </Field>
              <Field id="email" label="E-mail" error={errors.email?.message}>
                <Input id="email" type="email" autoComplete="off" aria-invalid={!!errors.email} {...register("email")} />
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <LocationFields savedStatus={staff?.location_status as LocationStatus | undefined} verifiedAt={staff?.location_updated_at} timeZone={timeZone} noun="la fiche" />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <h2 className="text-sm font-semibold">Compétences et notes</h2>
            <Field id="skills" label="Compétences" error={errors.skills?.message} hint="Séparées par des virgules ou des points-virgules (ex. aide-soignant, permis B).">
              <Input id="skills" autoComplete="off" {...register("skills")} />
            </Field>
            <Field id="notes" label="Notes" error={errors.notes?.message}>
              <Textarea id="notes" rows={4} {...register("notes")} />
            </Field>
          </CardBody>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={cancel} disabled={pending}>Annuler</Button>
          {!staff ? <Button variant="secondary" onClick={() => void submit(true)()} pending={pending}>Enregistrer et ajouter un autre</Button> : null}
          <Button type="submit" pending={pending}>{staff ? "Enregistrer les modifications" : "Enregistrer le staff"}</Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmCancel} title="Abandonner les modifications ?" description="Les changements non enregistrés seront perdus."
        confirmLabel="Abandonner" cancelLabel="Continuer l’édition" destructive
        onCancel={() => setConfirmCancel(false)} onConfirm={() => { setConfirmCancel(false); reset(); router.back(); }}
      />
    </FormProvider>
  );
}
