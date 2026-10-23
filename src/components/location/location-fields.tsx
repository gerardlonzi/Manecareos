"use client";
import * as React from "react";
import { useFormContext } from "react-hook-form";
import { CheckCircle2, Eraser, MapPin, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { previewLocation, type LocationPreview } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { LocationBadge } from "@/components/ui/badge";
import { COUNTRY_LIST, getCountry } from "@/config/countries";
import { formatDateTime } from "@/lib/utils";
import type { LocationStatus } from "@/lib/types";

export type LocationFormValues = { country_code: string; postal_code: string; city: string; region: string };

type Props = {
  /** Statut enregistré en base (formulaire d’édition). */
  savedStatus?: LocationStatus;
  verifiedAt?: string | null;
  timeZone?: string;
  noun?: string;
};

/** Champs d’adresse + « Valider / Revalider » (aperçu de géocodage) + « Effacer ». Les coordonnées sont toujours recalculées côté serveur à l’enregistrement. */
export function LocationFields({ savedStatus, verifiedAt, timeZone, noun = "la localisation" }: Props) {
  const { register, getValues, setValue, formState: { errors } } = useFormContext<LocationFormValues>();
  const [pending, start] = React.useTransition();
  const [preview, setPreview] = React.useState<LocationPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const validate = () => {
    setError(null);
    setPreview(null);
    const v = getValues();
    start(async () => {
      const r = await previewLocation({ country_code: v.country_code, postal_code: v.postal_code, city: v.city, region: v.region });
      if (!r.ok) { setError(r.fieldErrors ? Object.values(r.fieldErrors)[0] ?? r.error : r.error); return; }
      setPreview(r.data ?? null);
      if (r.data?.city && !v.city) setValue("city", r.data.city, { shouldDirty: true });
      if (r.data?.region && !v.region) setValue("region", r.data.region, { shouldDirty: true });
      if (r.data?.postalDisplay) setValue("postal_code", r.data.postalDisplay, { shouldDirty: true });
      toast.success("Lieu trouvé");
    });
  };

  const clear = () => {
    for (const f of ["postal_code", "city", "region"] as const) setValue(f, "", { shouldDirty: true });
    setPreview(null);
    setError(null);
  };

  const country = getCountry(getValues("country_code"));
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" aria-hidden /> Localisation enregistrée</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="country_code" label="Pays" error={errors.country_code?.message} required>
          <Select id="country_code" {...register("country_code")}>
            {COUNTRY_LIST.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
        </Field>
        <Field id="postal_code" label="Code postal" error={errors.postal_code?.message} hint={country && !country.postalReliable ? "Peu fiable dans ce pays : renseignez aussi la ville." : undefined}>
          <Input id="postal_code" autoComplete="off" aria-invalid={!!errors.postal_code} {...register("postal_code")} />
        </Field>
        <Field id="city" label="Ville" error={errors.city?.message}>
          <Input id="city" autoComplete="off" {...register("city")} />
        </Field>
        <Field id="region" label="Région / comté" error={errors.region?.message}>
          <Input id="region" autoComplete="off" {...register("region")} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={validate} pending={pending}>
          {savedStatus === "resolved" ? <RefreshCw className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
          {savedStatus === "resolved" ? "Revalider la localisation" : "Valider la localisation"}
        </Button>
        <Button variant="ghost" onClick={clear}><Eraser className="h-4 w-4" aria-hidden /> Effacer la localisation</Button>
        {savedStatus ? <LocationBadge status={savedStatus} /> : null}
      </div>

      {savedStatus && verifiedAt ? <p className="text-xs text-muted">Dernière vérification : {formatDateTime(verifiedAt, timeZone)}</p> : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {preview ? (
        <div className="rounded-lg border border-green-200 bg-success-soft px-3 py-2 text-sm text-success">
          <p className="font-medium">{preview.label}</p>
          <p className="mt-0.5 text-xs">Coordonnées approximatives (centre du code postal ou de la ville). Elles seront enregistrées à la sauvegarde de {noun}.</p>
        </div>
      ) : null}
    </fieldset>
  );
}
