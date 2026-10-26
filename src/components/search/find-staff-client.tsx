
"use client";

import * as React from "react";
import { Search, X, Compass } from "lucide-react";
import { toast } from "sonner";

import { geocodeSearchPoint } from "@/actions/search";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { countryPickerOptions, splitOptionId } from "@/components/location/country-options";
import { LocationPicker } from "@/components/location/location-picker";
import { CountryMapPreview } from "@/components/map/country-map-preview";
import { usePreferences } from "@/components/providers/preferences-provider";
import { friendlyError } from "@/lib/user-message";


import type { DistanceUnit } from "@/lib/geo/format";
import type {
  RoutingCapabilitiesDTO,
  SearchTarget,
} from "@/lib/search-types";
import type { TransportMode } from "@/lib/types";

import CandidateMap from "@/components/map/candidate-map-lazy";
import { CandidateSearch, type SharedMapState } from "./candidate-search";

type Props = {
  defaultCountry: string;
  routing: RoutingCapabilitiesDTO;
  mapToken?: string;
  unit: DistanceUnit;
  timeZone: string;
  defaults: {
    radiusKm: number;
    availability: "available" | "all";
    mode: TransportMode;
  };
};

type ReferenceTarget = SearchTarget & { kind: "point" };

export function FindStaffClient({
  defaultCountry,
  routing,
  mapToken,
  unit,
  timeZone,
  defaults,
}: Props) {
  const { t, locale } = usePreferences();

  const [countryId, setCountryId] = React.useState(defaultCountry);
  const { code: country, nation } = splitOptionId(countryId);
  const countryOptions = React.useMemo(() => countryPickerOptions(locale, { dial: false }), [locale]);
  const [postal, setPostal] = React.useState("");
  const [city, setCity] = React.useState("");
  const [region, setRegion] = React.useState("");

  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [target, setTarget] = React.useState<ReferenceTarget | null>(null);
  const [searchFormOpen, setSearchFormOpen] = React.useState(true);
  const [countryMapExpanded, setCountryMapExpanded] = React.useState(false);
  const [searchSequence, setSearchSequence] = React.useState(0);
  const [mapState, setMapState] = React.useState<SharedMapState | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!postal.trim() && !city.trim()) {
      setError(
        t(
          "Sélectionnez une ville ou un code postal dans les suggestions.",
          "Select a city or postal code from the suggestions.",
        ),
      );
      return;
    }

    startTransition(async () => {
      try {
        const result = await geocodeSearchPoint({
          country_code: country,
          postal_code: postal,
          city,
          region: region || nation || "",
        });

        if (!result.ok || !result.data) {
          const message = !result.ok
            ? result.fieldErrors
              ? friendlyError(
                  Object.values(result.fieldErrors)[0] ?? result.error,
                )
              : friendlyError(result.error)
            : t("Lieu introuvable.", "Location not found.");

          setError(message);
          return;
        }

        setTarget({
          kind: "point",
          latitude: result.data.latitude,
          longitude: result.data.longitude,
          label: result.data.label,
        });

        setSearchFormOpen(false);
        setSearchSequence((current) => current + 1);

        toast.success(t("Recherche lancée.", "Search location found."));
      } catch {
        setError(
          t(
            "Impossible de rechercher ce lieu pour le moment. Réessayez.",
            "Unable to search for this location right now. Please try again.",
          ),
        );
      }
    });
  };

  const clear = () => {
    setTarget(null);
    setPostal("");
    setCity("");
    setRegion("");
    setError(null);
    setSearchFormOpen(true);
  };

  const changeCountry = (nextCountry: string) => {
    setCountryId(nextCountry);
    setPostal("");
    setCity("");
    setRegion("");
    setTarget(null);
    setError(null);
  };

  return (
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.95fr)]">
      <section
        className={
          countryMapExpanded
            ? "fixed inset-0 z-[100] h-dvh bg-bg p-2 sm:p-4"
            : "min-w-0 xl:sticky xl:top-4 xl:self-start"
        }
        aria-label={t("Carte de recherche", "Search map")}
      >
        <div
          className={
            countryMapExpanded
              ? "h-full"
              : "h-[55vh] min-h-[340px] xl:h-[calc(100dvh-2rem)]"
          }
        >
          {target && mapState ? (
            <CandidateMap
              token={mapToken}
              origin={mapState.origin}
              radiusKm={mapState.radiusKm}
              candidates={mapState.candidates}
              highlightedId={mapState.highlightedId}
              onMarkerClick={mapState.onMarkerClick}
              routeCoordinates={mapState.routeCoordinates}
              approxLine={mapState.approxLine}
              className={countryMapExpanded ? "h-[calc(100dvh-2rem)]" : "h-[55vh] min-h-[340px] xl:h-[calc(100dvh-2rem)]"} 
                           expanded={countryMapExpanded}
              onToggleExpand={() => setCountryMapExpanded((current) => !current)}
            />
          ) : (
            <CountryMapPreview
              token={mapToken}
              countryCode={country}
              expanded={countryMapExpanded}
              fixedHeight
              onToggleExpand={() =>
                setCountryMapExpanded((current) => !current)
              }
              referencePoint={
                target
                  ? {
                      latitude: target.latitude,
                      longitude: target.longitude,
                      label: target.label ?? "",
                    }
                  : null
              }
            />
          )}
        </div>
      </section>

      <section
        className="min-w-0 space-y-3"
        aria-label={t("Recherche et résultats", "Search and results")}
      >
        <div className="sticky top-0 z-30 rounded-2xl border border-line bg-surface/95 p-3 shadow-sm backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchFormOpen((current) => !current)}
              aria-expanded={searchFormOpen}
              aria-controls="find-staff-search-form"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-line bg-bg px-3 py-3 text-left transition-colors hover:border-primary/50"
            >
              <Search className="h-4 w-4 shrink-0 text-primary" />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {target
                    ? target.label
                    : t(
                        "Rechercher une ville ou un code postal",
                        "Search a city or postal code",
                      )}
                </span>
                {target ? (
                  <span className="mt-1 block truncate text-xs text-muted">
                    {t(
                      "Modifier le pays ou le lieu",
                      "Change the country or location",
                    )}
                  </span>
                ) : null}
              </span>

              <span className="shrink-0 text-xs font-semibold text-primary">
                {searchFormOpen
                  ? t("Fermer", "Close")
                  : t("Rechercher", "Search")}
              </span>
            </button>

            {target ? (
              <Button
                type="button"
                variant="secondary"
                onClick={clear}
                aria-label={t("Effacer la recherche", "Clear search")}
                title={t("Effacer la recherche", "Clear search")}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          {searchFormOpen ? (
            <form
              id="find-staff-search-form"
              onSubmit={submit}
              className="mt-3 space-y-3 border-t border-line pt-3"
              aria-label={t("Recherche de localisation", "Location search")}
            >
              <Field id="fs-country" label={t("Pays", "Country")}>
                <SearchablePicker
                  id="fs-country"
                  value={countryId}
                  options={countryOptions}
                  onValueChange={changeCountry}
                  searchPlaceholder={t("Rechercher un pays…", "Search country…")}
                />
              </Field>

              <LocationPicker
                countryCode={country}
                nation={nation}
                postal={postal}
                city={city}
                region={region}
                setPostal={setPostal}
                setCity={setCity}
                setRegion={setRegion}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  pending={pending}
                  disabled={pending || (!postal.trim() && !city.trim())}
                  className="flex-1"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  {t("Rechercher du staff", "Find staff")}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={clear}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  {t("Effacer", "Clear")}
                </Button>
              </div>

              {error ? (
                <p
                  role="alert"
                  className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger"
                >
                  {error}
                </p>
              ) : null}
            </form>
          ) : null}
        </div>

        {target ? (
          <CandidateSearch
            key={searchSequence}
            onMapState={setMapState}
            target={target}
            routing={routing}
            mapToken={mapToken}
            unit={unit}
            timeZone={timeZone}
            defaults={defaults}
          />
        ) : (
          <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-line bg-surface p-6 text-center">
            <div className="max-w-sm">
              <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-primary-soft text-primary">
                <Compass className="h-5 w-5" />
              </span>

              <h2 className="font-semibold text-ink">
                {t("Définir un lieu de recherche", "Set a search location")}
              </h2>

              <p className="mt-2 text-sm leading-6 text-muted">
                {t(
                  "Recherchez une ville ou un code postal pour afficher les membres du personnel correspondants.",
                  "Search a city or postal code to find matching staff.",
                )}
              </p>

              {!searchFormOpen ? (
                <Button
                  type="button"
                  className="mt-4"
                  onClick={() => setSearchFormOpen(true)}
                >
                  <Search className="h-4 w-4" />
                  {t("Commencer une recherche", "Start a search")}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
