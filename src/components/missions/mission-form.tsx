"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { saveMission } from "@/actions/missions";
import { LocationFields } from "@/components/location/location-fields";
import { SkillPicker } from "@/components/staff/skill-picker";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FormPage, Input, Textarea } from "@/components/ui/form";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { useUnsavedWarning } from "@/components/use-unsaved-warning";
import { usePreferences } from "@/components/providers/preferences-provider";
import type { Mission, TransportMode } from "@/lib/types";
import { utcIsoToZonedLocal } from "@/lib/time";

const MODES: TransportMode[] = ["driving", "walking", "cycling", "public_transport"];

const makeSchema = (t: (fr: string, en: string) => string) => z.object({
  title: z.string().trim().min(1, t("Le titre est obligatoire", "Title is required")).max(200),
  mission_reference: z.string().max(60),
  description: z.string().max(4000),
  required_staff_count: z.string().regex(/^\d+$/, t("Nombre entier requis", "Whole number required")).refine((v) => Number(v) >= 1, t("Au moins 1", "At least 1")).refine((v) => Number(v) <= 1000, t("1000 maximum", "1000 maximum")),
  required_skills: z.string().max(1000),
  scheduled_start_local: z.string(),
  scheduled_end_local: z.string(),
  transport_mode: z.enum(["driving", "walking", "cycling", "public_transport"]),
  notes: z.string().max(4000),
  country_code: z.string().length(2, t("Choisissez un pays", "Choose a country")),
  postal_code: z.string().max(16),
  city: z.string().max(120),
  region: z.string().max(120),
}).refine((v) => !v.scheduled_start_local || !v.scheduled_end_local || v.scheduled_end_local >= v.scheduled_start_local, {
  path: ["scheduled_end_local"], message: t("La fin ne peut pas précéder le début", "End cannot be before start"),
});
type Values = z.infer<ReturnType<typeof makeSchema>>;

type Props = { mission?: Mission; defaultCountry: string; timeZone: string; supportedModes: TransportMode[]; defaultMode: TransportMode };

export function MissionForm({ mission, defaultCountry, timeZone, supportedModes, defaultMode }: Props) {
  const router = useRouter();
  const { t, tm } = usePreferences();
  const schema = React.useMemo(() => makeSchema(t), [t]);
  const [pending, start] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const submitting = React.useRef(false);
  const modeLabel: Record<TransportMode, string> = { driving: t("Voiture", "Car"), walking: t("Marche", "Walking"), cycling: t("Vélo", "Bicycle"), public_transport: t("Transports en commun", "Public transport") };

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
  const { register, handleSubmit, setError, reset, setValue, watch, formState: { errors, isDirty } } = form;
  const requiredSkillsValue = watch("required_skills");
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
          setFormError(tm(r.error));
          for (const [k, m] of Object.entries(r.fieldErrors ?? {})) if (k in values) setError(k as keyof Values, { message: tm(m) });
          toast.error(tm(r.error));
          return;
        }
        toast.success(tm(r.message ?? "Enregistré"));
        reset(values);
        router.push(`/missions/${r.data?.id}${mission ? "" : "?created=1"}`);
        router.refresh();
      });
    });

  const cancel = () => (isDirty ? setConfirmCancel(true) : router.back());
  const isDraft = !mission || mission.status === "draft";

  return (
    <FormProvider {...form}>
      <FormPage>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-5 pb-4" noValidate>
        {formError ? <Alert tone="danger">{formError}</Alert> : null}

        <Card>
          <CardBody className="space-y-4">
            <h2 className="text-sm font-semibold">{t("Détails de la mission", "Assignment details")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="title" label={t("Titre de la mission", "Assignment title")} error={errors.title?.message} required className="sm:col-span-2">
                <Input id="title" autoComplete="off" aria-invalid={!!errors.title} {...register("title")} />
              </Field>
              <Field id="mission_reference" label={t("Référence", "Reference")} error={errors.mission_reference?.message} hint={t("Facultative, unique dans votre compte.", "Optional, unique within your account.")}>
                <Input id="mission_reference" autoComplete="off" {...register("mission_reference")} />
              </Field>
              <Field id="required_staff_count" label={t("Nombre de personnes requises", "Number of people required")} error={errors.required_staff_count?.message} required>
                <Input id="required_staff_count" type="number" inputMode="numeric" min={1} max={1000} step={1} aria-invalid={!!errors.required_staff_count} {...register("required_staff_count")} />
              </Field>
              <Field id="required_skills" label={t("Compétences requises", "Required skills")} error={errors.required_skills?.message} hint={t("Recherchez puis sélectionnez les compétences nécessaires. Seul le staff correspondant à tous les critères sera proposé.", "Search and select the required skills. Only staff matching all selected criteria will be suggested.")} className="sm:col-span-2">
                <input type="hidden" {...register("required_skills")} />
                <SkillPicker id="mission-skills-search" value={requiredSkillsValue} onChange={(value) => setValue("required_skills", value, { shouldDirty: true, shouldValidate: true })} />
              </Field>
              <Field id="scheduled_start_local" label={`${t("Début (heure locale", "Start (local time")}, ${timeZone})`} error={errors.scheduled_start_local?.message}>
                <Input id="scheduled_start_local" type="datetime-local" {...register("scheduled_start_local")} />
              </Field>
              <Field id="scheduled_end_local" label={t("Fin", "End")} error={errors.scheduled_end_local?.message}>
                <Input id="scheduled_end_local" type="datetime-local" aria-invalid={!!errors.scheduled_end_local} {...register("scheduled_end_local")} />
              </Field>
              <Field id="description" label={t("Description", "Description")} error={errors.description?.message} className="sm:col-span-2">
                <Textarea id="description" rows={3} {...register("description")} />
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <LocationFields savedStatus={mission?.location_status} verifiedAt={mission?.location_updated_at} timeZone={timeZone} noun="la mission" />
            <p className="mt-3 text-xs text-muted">{t("La recherche de staff par distance reste indisponible tant que le lieu de la mission n’est pas vérifié.", "Staff distance search remains unavailable until the assignment location is verified.")}</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <h2 className="text-sm font-semibold">{t("Préférences de déplacement", "Travel preferences")}</h2>
            <Field id="transport_mode" label={t("Mode de transport préféré", "Preferred transport mode")} error={errors.transport_mode?.message}>
              <input type="hidden" {...register("transport_mode")} />
              <SearchablePicker id="transport_mode" value={watch("transport_mode")} onValueChange={(v) => setValue("transport_mode", v as Values["transport_mode"], { shouldDirty: true })}
                options={MODES.map((m) => ({ value: m, label: `${modeLabel[m]}${supportedModes.includes(m) ? "" : ` — ${t("non pris en charge", "not supported")}`}` }))} />
            </Field>
            {!supportedModes.includes("public_transport") ? (
              <p className="text-xs text-muted">{t("Les transports en commun ne sont pas disponibles actuellement. Aucun trajet en bus ou en train n’est simulé.", "Public transport is not currently available. Bus or train journeys are never simulated.")}</p>
            ) : null}
            <Field id="notes" label={t("Notes", "Notes")} error={errors.notes?.message}>
              <Textarea id="notes" rows={3} {...register("notes")} />
            </Field>
          </CardBody>
        </Card>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-bg/90 py-3 backdrop-blur">
          <Button variant="ghost" onClick={cancel} disabled={pending}>{t("Annuler", "Cancel")}</Button>
          {isDraft ? <Button variant="secondary" onClick={() => void submit("draft")()} pending={pending}>{t("Enregistrer le brouillon", "Save draft")}</Button> : null}
          <Button onClick={() => void submit("open")()} pending={pending}>{!mission ? t("Créer la mission", "Create assignment") : isDraft ? t("Enregistrer et ouvrir", "Save and open") : t("Enregistrer les modifications", "Save changes")}</Button>
        </div>
      </form>
      </FormPage>

      <ConfirmDialog
        open={confirmCancel} title={t("Abandonner les modifications ?", "Discard changes?")} description={t("Les changements non enregistrés seront perdus.", "Unsaved changes will be lost.")}
        confirmLabel={t("Abandonner", "Discard")} cancelLabel={t("Continuer l’édition", "Keep editing")} destructive
        onCancel={() => setConfirmCancel(false)} onConfirm={() => { setConfirmCancel(false); reset(); router.back(); }}
      />
    </FormProvider>
  );
}
