"use client";
import { friendlyError } from "@/lib/user-message";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changePassword, clearRouteCache, resetLocationPrefs, signOutOtherSessions, updateLocationPrefs, updateProfile } from "@/actions/settings";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { countryName } from "@/config/countries";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useUnsavedWarning } from "@/components/use-unsaved-warning";
import { APP_CONFIG, TRANSPORT_LABELS } from "@/config/app";
import { COUNTRY_LIST } from "@/config/countries";
import type { Profile, TransportMode } from "@/lib/types";

const TRANSPORT_EN: Record<string, string> = { driving: "Car", walking: "Walking", cycling: "Bike", public_transport: "Public transport" };

function timeZones(current: string): string[] {
  let list: string[] = [];
  try { list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? []; } catch { /* navigateur ancien */ }
  if (!list.includes("UTC")) list = ["UTC", ...list];
  if (current && !list.includes(current)) list = [current, ...list];
  return list;
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const { t, tm, locale } = usePreferences();
  const [pending, start] = React.useTransition();
  const [v, setV] = React.useState({ full_name: profile.full_name, company_name: profile.company_name ?? "", country_code: profile.country_code, timezone: profile.timezone });
  const [saved, setSaved] = React.useState(v);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  useUnsavedWarning(dirty && !pending);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  const zones = React.useMemo(() => timeZones(profile.timezone), [profile.timezone]);

  return (
    <Card>
      <CardHeader title={t("Profil du manager", "Manager profile")} />
      <CardBody>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => {
          e.preventDefault();
          setErrors({});
          start(async () => {
            const r = await updateProfile(v);
            if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(tm(friendlyError(r.error))); return; }
            setSaved(v); toast.success(tm(r.message ?? "Enregistré")); router.refresh();
          });
        }}>
          <Field id="full_name" label={t("Nom complet", "Full name")} error={errors.full_name} required><Input id="full_name" value={v.full_name} onChange={set("full_name")} /></Field>
          <Field id="company_name" label={t("Entreprise", "Company")} error={errors.company_name}><Input id="company_name" value={v.company_name} onChange={set("company_name")} /></Field>
          <Field id="country_code" label={t("Pays principal", "Primary country")} error={errors.country_code}>
            <Combobox id="country_code" value={v.country_code} options={COUNTRY_LIST.map((c) => ({ value: c.code, label: countryName(c.code, locale), description: `+${c.dialCode}`, flag: c.code.toLowerCase() }))} onChange={(value) => setV((p) => ({ ...p, country_code: value }))} searchPlaceholder={t("Rechercher un pays…", "Search country…")} />
          </Field>
          <Field id="timezone" label={t("Fuseau horaire", "Time zone")} error={errors.timezone}>
            <Combobox id="timezone" value={v.timezone} onChange={(x) => setV((p) => ({ ...p, timezone: x }))} options={zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }))} searchPlaceholder={t("Rechercher un fuseau…", "Search time zone…")} />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="ghost" disabled={!dirty || pending} onClick={() => { setV(saved); setErrors({}); }}>{t("Annuler", "Cancel")}</Button>
            <Button type="submit" pending={pending} disabled={!dirty}>{t("Enregistrer", "Save")}</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function LocationPrefsForm({ profile, supportedModes, defaultCountry }: { profile: Profile; supportedModes: TransportMode[]; defaultCountry: string }) {
  const router = useRouter();
  const { t, tm, locale } = usePreferences();
  const [pending, start] = React.useTransition();
  const [resetting, startReset] = React.useTransition();
  const [clearing, startClear] = React.useTransition();
  const initial = { country_code: profile.country_code || defaultCountry, default_search_radius_km: String(profile.default_search_radius_km), default_availability_filter: profile.default_availability_filter, default_transport_mode: profile.default_transport_mode, distance_unit: profile.distance_unit, allow_fallback_estimates: profile.allow_fallback_estimates };
  const [v, setV] = React.useState(initial);
  const [saved, setSaved] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  useUnsavedWarning(dirty && !pending);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  const modes = (Object.keys(TRANSPORT_LABELS) as TransportMode[]).filter((m) => supportedModes.includes(m));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={t("Préférences de recherche et de déplacement", "Search and travel preferences")} description={t("Seuls les modes de transport réellement calculables par le fournisseur d’itinéraires sont proposés.", "Only transport modes supported by the configured routing provider are offered.")} />
        <CardBody>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            start(async () => {
              const r = await updateLocationPrefs({ ...v, default_search_radius_km: Number(v.default_search_radius_km) });
              if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(tm(friendlyError(r.error))); return; }
              setSaved(v); toast.success(tm(r.message ?? "Enregistré")); router.refresh();
            });
          }}>
            <Field id="p_country" label={t("Pays par défaut", "Default country")} error={errors.country_code}>
              <Combobox id="p_country" value={v.country_code} options={COUNTRY_LIST.map((c) => ({ value: c.code, label: countryName(c.code, locale), description: `+${c.dialCode}` }))} onChange={(value) => setV((p) => ({ ...p, country_code: value }))} searchPlaceholder={t("Rechercher un pays…", "Search country…")} />
            </Field>
            <Field id="p_radius" label={t("Rayon de recherche par défaut", "Default search radius")} error={errors.default_search_radius_km}>
              <Combobox id="p_radius" value={String(v.default_search_radius_km)} onChange={(x) => setV((p) => ({ ...p, default_search_radius_km: x }))} options={APP_CONFIG.search.radiiKm.map((r) => ({ value: String(r), label: `${r} km` }))} />
            </Field>
            <Field id="p_avail" label={t("Filtre de disponibilité par défaut", "Default availability filter")} error={errors.default_availability_filter}>
              <Combobox id="p_avail" value={v.default_availability_filter} onChange={(x) => setV((p) => ({ ...p, default_availability_filter: x as "available" | "all" }))} options={[{ value: "available", label: t("Disponibles uniquement", "Available only") }, { value: "all", label: t("Tous les statuts", "All statuses") }]} />
            </Field>
            <Field id="p_mode" label={t("Mode de transport par défaut", "Default transport mode")} error={errors.default_transport_mode}>
              <Combobox id="p_mode" value={v.default_transport_mode} onChange={(x) => setV((p) => ({ ...p, default_transport_mode: x as TransportMode }))} options={modes.map((m) => ({ value: m, label: t(TRANSPORT_LABELS[m], TRANSPORT_EN[m] ?? m) }))} />
            </Field>
            <Field id="p_unit" label={t("Unité de distance", "Distance unit")} error={errors.distance_unit}>
              <Combobox id="p_unit" value={v.distance_unit} onChange={(x) => setV((p) => ({ ...p, distance_unit: x as "km" | "mi" }))} options={[{ value: "km", label: t("Kilomètres", "Kilometres") }, { value: "mi", label: t("Miles", "Miles") }]} />
            </Field>
            <div className="sm:col-span-2">
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={v.allow_fallback_estimates} onChange={(e) => setV((p) => ({ ...p, allow_fallback_estimates: e.target.checked }))} />
                <span>
                  <span className="font-medium">{t("Autoriser les estimations approximatives de repli", "Allow approximate fallback estimates")}</span>
                  <span className="block text-muted">{t("Si le fournisseur d’itinéraires échoue, un temps à vitesse moyenne est affiché, clairement étiqueté « approximation » (jamais pour les transports en commun). Désactivé par défaut.", "If routing fails, an average-speed estimate may be shown and clearly labelled as approximate (never for public transport). Off by default.")}</span>
                </span>
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
              <Button variant="ghost" pending={resetting} onClick={() => startReset(async () => {
                const r = await resetLocationPrefs();
                if (r.ok) { toast.success(tm(r.message ?? "Réinitialisé")); router.refresh(); } else toast.error(tm(friendlyError(r.error)));
              })}>{t("Réinitialiser les valeurs par défaut", "Reset to defaults")}</Button>
              <Button type="submit" pending={pending} disabled={!dirty}>{t("Enregistrer les préférences", "Save preferences")}</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("Cache des estimations d’itinéraire", "Route estimate cache")} description={t("Les estimations réussies sont conservées 7 jours, uniquement dans votre compte, pour limiter les appels au fournisseur.", "Successful estimates are kept for 7 days, in your account only, to limit calls to the provider.")} />
        <CardBody>
          <Button variant="secondary" pending={clearing} onClick={() => startClear(async () => {
            const r = await clearRouteCache();
            if (r.ok) toast.success(tm(r.message ?? "Cache vidé")); else toast.error(tm(friendlyError(r.error)));
          })}>{t("Vider le cache d’itinéraires", "Clear route cache")}</Button>
        </CardBody>
      </Card>
    </div>
  );
}

export function SecurityForms() {
  const { t, tm } = usePreferences();
  const [pending, start] = React.useTransition();
  const [others, startOthers] = React.useTransition();
  const [v, setV] = React.useState({ password: "", confirm: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={t("Changer le mot de passe", "Change password")} description={t("10 caractères minimum, avec au moins une lettre et un chiffre.", "At least 10 characters, with at least one letter and one digit.")} />
        <CardBody>
          <form className="grid max-w-md gap-4" onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            start(async () => {
              const r = await changePassword(v);
              if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(tm(friendlyError(r.error))); return; }
              setV({ password: "", confirm: "" }); toast.success(tm(r.message ?? "Mot de passe modifié"));
            });
          }}>
            <Field id="new_password" label={t("Nouveau mot de passe", "New password")} error={errors.password} required>
              <PasswordInput id="new_password" autoComplete="new-password" value={v.password} onChange={(e) => setV((p) => ({ ...p, password: e.target.value }))} />
            </Field>
            <Field id="confirm_password" label={t("Confirmer le mot de passe", "Confirm password")} error={errors.confirm} required>
              <PasswordInput id="confirm_password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV((p) => ({ ...p, confirm: e.target.value }))} />
            </Field>
            <div><Button type="submit" pending={pending} disabled={!v.password}>{t("Changer le mot de passe", "Change password")}</Button></div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("Sessions", "Sessions")} />
        <CardBody className="space-y-3">
          <Alert tone="info">{t("La session de ce navigateur est conservée de manière sécurisée. Vous pouvez fermer les autres sessions ouvertes sur vos appareils.", "This browser’s session is stored securely. You can close the other sessions open on your devices.")}</Alert>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" pending={others} onClick={() => startOthers(async () => {
              const r = await signOutOtherSessions();
              if (r.ok) toast.success(tm(r.message ?? "Fait")); else toast.error(tm(friendlyError(r.error)));
            })}>{t("Fermer les autres sessions", "Close other sessions")}</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
