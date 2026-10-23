"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { saveMission } from "@/actions/missions";
import { LocationFields } from "@/components/location/location-fields";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useUnsavedWarning } from "@/components/use-unsaved-warning";
import { TRANSPORT_LABELS } from "@/config/app";
import type { Mission, TransportMode } from "@/lib/types";
import { utcIsoToZonedLocal } from "@/lib/time";

const MODES: TransportMode[] = ["driving", "walking", "cycling", "public_transport"];

const schema = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire").max(200),
  mission_reference: z.string().max(60),
  description: z.string().max(4000),
  required_staff_count: z.string().regex(/^\d+$/, "Nombre entier requis").refine((v) => Number(v) >= 1, "Au moins 1").refine((v) => Number(v) <= 1000, "1000 maximum"),
  required_skills: z.string().max(1000),
  scheduled_start_local: z.string(),
  scheduled_end_local: z.string(),
  transport_mode: z.enum(["driving", "walking", "cycling", "public_transport"]),
  notes: z.string().max(4000),
  country_code: z.string().length(2, "Choisissez un pays"),
  postal_code: z.string().max(16),
  city: z.string().max(120),
  region: z.string().max(120),
}).refine((v) => !v.scheduled_start_local || !v.scheduled_end_local || v.scheduled_end_local >= v.scheduled_start_local, {
  path: ["scheduled_end_local"], message: "La fin ne peut pas précéder le début",
});
type Values = z.infer<typeof schema>;

type Props = { mission?: Mission; defaultCountry: string; timeZone: string; supportedModes: TransportMode[]; defaultMode: TransportMode };

export function MissionForm({ mission, defaultCountry, timeZone, supportedModes, defaultMode }: Props) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const submitting = React.useRef(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: mission?.title ?? "",
      mission_reference: mission?.mission_reference ?? "",
      description: mission?.description ?? "",
      required_staff_count: String(mission?.required_staff_count ?? 1),
      required_skills: mission?.required_skills.join(", ") ?? "",
      scheduled_start_local: utcIsoToZonedLocal(mission?.scheduled_start_at, timeZone),
      scheduled_end_local: utcIsoToZonedLocal(mission?.scheduled_end_at, timeZone),
      transport_mode: mission?.transport_mode ?? (supportedModes.includes(defaultMode) ? defaultMode : supportedModes[0] ?? "driving"),
      notes: mission?.notes ?? "",
      country_code: mission?.country_code ?? defaultCountry,
      postal_code: mission?.postal_code ?? "",
      city: mission?.city ?? "",
      region: mission?.region ?? "",
    },
  });
  const { register, handleSubmit, setError, reset, formState: { errors, isDirty } } = form;
  useUnsavedWarning(isDirty && !pending);

  const submit = (intent: "draft" | "open") =>
    handleSubmit((values) => {
      if (submitting.current) return;
      submitting.current = true;
      setFormError(null);
      start(async () => {
        const r = await saveMission({ ...values, intent }, mission?.id);
        submitting.current = false;
        if (!r.ok) {
          setFormError(r.error);
          for (const [k, m] of Object.entries(r.fieldErrors ?? {})) if (k in values) setError(k as keyof Values, { message: m });
          toast.error(r.error);
          return;
        }
        toast.success(r.message ?? "Enregistré");
        reset(values);
        router.push(`/missions/${r.data?.id}${mission ? "" : "?created=1"}`);
        router.refresh();
      });
    });

  const cancel = () => (isDirty ? setConfirmCancel(true) : router.back());
  const isDraft = !mission || mission.status === "draft";

  return (
    <FormProvider {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6" noValidate>
        {formError ? <Alert tone="danger">{formError}</Alert> : null}

        <Card>
          <CardBody className="space-y-4">
            <h2 className="text-sm font-semibold">Détails de la mission</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="title" label="Titre de la mission" error={errors.title?.message} required className="sm:col-span-2">
                <Input id="title" autoComplete="off" aria-invalid={!!errors.title} {...register("title")} />
              </Field>
              <Field id="mission_reference" label="Référence" error={errors.mission_reference?.message} hint="Facultative, unique dans votre compte.">
                <Input id="mission_reference" autoComplete="off" {...register("mission_reference")} />
              </Field>
              <Field id="required_staff_count" label="Nombre de personnes requises" error={errors.required_staff_count?.message} required>
                <Input id="required_staff_count" type="number" inputMode="numeric" min={1} max={1000} step={1} aria-invalid={!!errors.required_staff_count} {...register("required_staff_count")} />
              </Field>
              <Field id="required_skills" label="Compétences requises" error={errors.required_skills?.message} hint="Séparées par des virgules. Seul le staff possédant toutes ces compétences est proposé." className="sm:col-span-2">
                <Input id="required_skills" autoComplete="off" {...register("required_skills")} />
              </Field>
              <Field id="scheduled_start_local" label={`Début (heure locale, ${timeZone})`} error={errors.scheduled_start_local?.message}>
                <Input id="scheduled_start_local" type="datetime-local" {...register("scheduled_start_local")} />
              </Field>
              <Field id="scheduled_end_local" label="Fin" error={errors.scheduled_end_local?.message}>
                <Input id="scheduled_end_local" type="datetime-local" aria-invalid={!!errors.scheduled_end_local} {...register("scheduled_end_local")} />
              </Field>
              <Field id="description" label="Description" error={errors.description?.message} className="sm:col-span-2">
                <Textarea id="description" rows={3} {...register("description")} />
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <LocationFields savedStatus={mission?.location_status} verifiedAt={mission?.location_updated_at} timeZone={timeZone} noun="la mission" />
            <p className="mt-3 text-xs text-muted">La recherche de staff par distance reste indisponible tant que le lieu de la mission n’est pas vérifié.</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <h2 className="text-sm font-semibold">Préférences de déplacement</h2>
            <Field id="transport_mode" label="Mode de transport préféré" error={errors.transport_mode?.message}>
              <Select id="transport_mode" {...register("transport_mode")}>
                {MODES.map((m) => {
                  const ok = supportedModes.includes(m);
                  return <option key={m} value={m} disabled={!ok}>{TRANSPORT_LABELS[m]}{ok ? "" : " — non pris en charge"}</option>;
                })}
              </Select>
            </Field>
            {!supportedModes.includes("public_transport") ? (
              <p className="text-xs text-muted">Les transports en commun sont désactivés : aucun fournisseur d’horaires n’est configuré, et StaffFlow ne simule jamais un trajet en bus ou en train avec des données de voiture.</p>
            ) : null}
            <Field id="notes" label="Notes" error={errors.notes?.message}>
              <Textarea id="notes" rows={3} {...register("notes")} />
            </Field>
          </CardBody>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={cancel} disabled={pending}>Annuler</Button>
          {isDraft ? <Button variant="secondary" onClick={() => void submit("draft")()} pending={pending}>Enregistrer le brouillon</Button> : null}
          <Button onClick={() => void submit("open")()} pending={pending}>{!mission ? "Créer la mission" : isDraft ? "Enregistrer et ouvrir" : "Enregistrer les modifications"}</Button>
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
