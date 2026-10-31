"use client";
import * as React from "react";
import { useFormContext } from "react-hook-form";
import { CheckCircle2, Eraser, MapPin, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { previewLocation, type LocationPreview } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { LocationBadge } from "@/components/ui/badge";
import { LocationPicker } from "@/components/location/location-picker";
import { usePreferences } from "@/components/providers/preferences-provider";
import { friendlyError } from "@/lib/user-message";
import { optionIdFor } from "@/config/countries";
import { countryPickerOptions, splitOptionId } from "./country-options";
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
  const { register, getValues, setValue, watch, formState: { errors } } = useFormContext<LocationFormValues>();
  const { t, locale } = usePreferences();
  const countryCode = watch("country_code");
  const postal = watch("postal_code");
  const cityValue = watch("city");
  const regionValue = watch("region");
  const options = React.useMemo(() => countryPickerOptions(locale, { dial: false }), [locale]);
  const nation = splitOptionId(optionIdFor(countryCode, regionValue)).nation;
  const [pending, start] = React.useTransition();
  const [preview, setPreview] = React.useState<LocationPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const validate = () => {
    setError(null);
    setPreview(null);
    const v = getValues();
    start(async () => {
      const r = await previewLocation({ country_code: v.country_code, postal_code: v.postal_code, city: v.city, region: v.region });
      if (!r.ok) { setError(r.fieldErrors ? friendlyError(Object.values(r.fieldErrors)[0] ?? r.error) : friendlyError(r.error)); return; }
      setPreview(r.data ?? null);
      if (r.data?.city && !v.city) setValue("city", r.data.city, { shouldDirty: true });
      if (r.data?.region && !v.region) setValue("region", r.data.region, { shouldDirty: true });
      if (r.data?.postalDisplay) setValue("postal_code", r.data.postalDisplay, { shouldDirty: true });
      toast.success(t("Lieu trouvé", "Place found"));
    });
  };

  const clear = () => {
    for (const f of ["postal_code", "city", "region"] as const) setValue(f, "", { shouldDirty: true });
    setPreview(null);
    setError(null);
  };

  return (
    <fieldset className="space-y-4">
      <div className="space-y-4">
        <Field id="country_code" label={t("Pays / nation", "Country / nation")} error={errors.country_code?.message} required>
          <input type="hidden" {...register("country_code")} />
          <SearchablePicker id="country_code" value={optionIdFor(countryCode, regionValue)} options={options}
            onValueChange={(id) => {
              const { code, nation } = splitOptionId(id);
              setValue("country_code", code, { shouldDirty: true, shouldValidate: true });
              setValue("postal_code", "", { shouldDirty: true }); setValue("city", "", { shouldDirty: true }); setValue("region", nation ?? "", { shouldDirty: true });
            }}
            searchPlaceholder={t("Rechercher un pays…", "Search country…")} />
        </Field>
        <input type="hidden" {...register("postal_code")} />
        <input type="hidden" {...register("city")} />
        <input type="hidden" {...register("region")} />
        <LocationPicker countryCode={countryCode} nation={nation} postal={postal} city={cityValue} region={regionValue}
          setPostal={(v) => setValue("postal_code", v, { shouldDirty: true, shouldValidate: true })}
          setCity={(v) => setValue("city", v, { shouldDirty: true, shouldValidate: true })}
          setRegion={(v) => setValue("region", v, { shouldDirty: true, shouldValidate: true })}
          error={errors.city?.message || errors.postal_code?.message || errors.region?.message} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={validate} pending={pending}>
          {savedStatus === "resolved" ? <RefreshCw className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
          {savedStatus === "resolved" ? t("Revalider la localisation", "Revalidate location") : t("Valider la localisation", "Validate location")}
        </Button>
        <Button variant="ghost" onClick={clear}><Eraser className="h-4 w-4" aria-hidden /> {t("Effacer la localisation", "Clear location")}</Button>
        {savedStatus ? <LocationBadge status={savedStatus} /> : null}
      </div>

      {savedStatus && verifiedAt ? <p className="text-xs text-muted">{t("Dernière vérification", "Last verified")} : {formatDateTime(verifiedAt, timeZone)}</p> : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {preview ? (
        <div className="rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
          <p className="font-medium">{preview.label}</p>
          <p className="mt-0.5 text-xs">{t("Coordonnées approximatives (centre du code postal ou de la ville), enregistrées avec la fiche.", "Approximate coordinates (postcode or city centre), saved with the profile.")}</p>
        </div>
      ) : null}
    </fieldset>
  );
}
