"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changePassword, clearRouteCache, resetLocationPrefs, signOutOtherSessions, updateLocationPrefs, updateProfile } from "@/actions/settings";
import { logout } from "@/actions/auth";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { useUnsavedWarning } from "@/components/use-unsaved-warning";
import { APP_CONFIG, TRANSPORT_LABELS } from "@/config/app";
import { COUNTRY_LIST } from "@/config/countries";
import type { Profile, TransportMode } from "@/lib/types";

function timeZones(current: string): string[] {
  let list: string[] = [];
  try { list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? []; } catch { /* navigateur ancien */ }
  if (!list.includes("UTC")) list = ["UTC", ...list];
  if (current && !list.includes(current)) list = [current, ...list];
  return list;
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
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
      <CardHeader title="Profil du manager" />
      <CardBody>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => {
          e.preventDefault();
          setErrors({});
          start(async () => {
            const r = await updateProfile(v);
            if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
            setSaved(v); toast.success(r.message ?? "Enregistré"); router.refresh();
          });
        }}>
          <Field id="full_name" label="Nom complet" error={errors.full_name} required><Input id="full_name" value={v.full_name} onChange={set("full_name")} /></Field>
          <Field id="company_name" label="Entreprise" error={errors.company_name}><Input id="company_name" value={v.company_name} onChange={set("company_name")} /></Field>
          <Field id="country_code" label="Pays principal" error={errors.country_code}>
            <Select id="country_code" value={v.country_code} onChange={set("country_code")}>{COUNTRY_LIST.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Select>
          </Field>
          <Field id="timezone" label="Fuseau horaire" error={errors.timezone}>
            <Select id="timezone" value={v.timezone} onChange={set("timezone")}>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</Select>
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="ghost" disabled={!dirty || pending} onClick={() => { setV(saved); setErrors({}); }}>Annuler</Button>
            <Button type="submit" pending={pending} disabled={!dirty}>Enregistrer</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function LocationPrefsForm({ profile, supportedModes, defaultCountry }: { profile: Profile; supportedModes: TransportMode[]; defaultCountry: string }) {
  const router = useRouter();
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
        <CardHeader title="Préférences de recherche et de déplacement" description="Seuls les modes de transport réellement calculables par le fournisseur d’itinéraires sont proposés." />
        <CardBody>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            start(async () => {
              const r = await updateLocationPrefs({ ...v, default_search_radius_km: Number(v.default_search_radius_km) });
              if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
              setSaved(v); toast.success(r.message ?? "Enregistré"); router.refresh();
            });
          }}>
            <Field id="p_country" label="Pays par défaut" error={errors.country_code}>
              <Select id="p_country" value={v.country_code} onChange={set("country_code")}>{COUNTRY_LIST.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Select>
            </Field>
            <Field id="p_radius" label="Rayon de recherche par défaut" error={errors.default_search_radius_km}>
              <Select id="p_radius" value={v.default_search_radius_km} onChange={set("default_search_radius_km")}>{APP_CONFIG.search.radiiKm.map((r) => <option key={r} value={r}>{r} km</option>)}</Select>
            </Field>
            <Field id="p_avail" label="Filtre de disponibilité par défaut" error={errors.default_availability_filter}>
              <Select id="p_avail" value={v.default_availability_filter} onChange={set("default_availability_filter")}><option value="available">Disponibles uniquement</option><option value="all">Tous les statuts</option></Select>
            </Field>
            <Field id="p_mode" label="Mode de transport par défaut" error={errors.default_transport_mode}>
              <Select id="p_mode" value={v.default_transport_mode} onChange={set("default_transport_mode")}>{modes.map((m) => <option key={m} value={m}>{TRANSPORT_LABELS[m]}</option>)}</Select>
            </Field>
            <Field id="p_unit" label="Unité de distance" error={errors.distance_unit}>
              <Select id="p_unit" value={v.distance_unit} onChange={set("distance_unit")}><option value="km">Kilomètres</option><option value="mi">Miles</option></Select>
            </Field>
            <div className="sm:col-span-2">
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={v.allow_fallback_estimates} onChange={(e) => setV((p) => ({ ...p, allow_fallback_estimates: e.target.checked }))} />
                <span>
                  <span className="font-medium">Autoriser les estimations approximatives de repli</span>
                  <span className="block text-muted">Si le fournisseur d’itinéraires échoue, un temps à vitesse moyenne est affiché, clairement étiqueté « approximation » (jamais pour les transports en commun). Désactivé par défaut.</span>
                </span>
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
              <Button variant="ghost" pending={resetting} onClick={() => startReset(async () => {
                const r = await resetLocationPrefs();
                if (r.ok) { toast.success(r.message ?? "Réinitialisé"); router.refresh(); } else toast.error(r.error);
              })}>Réinitialiser les valeurs par défaut</Button>
              <Button type="submit" pending={pending} disabled={!dirty}>Enregistrer les préférences</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Cache des estimations d’itinéraire" description="Les estimations réussies sont conservées 7 jours, uniquement dans votre compte, pour limiter les appels au fournisseur." />
        <CardBody>
          <Button variant="secondary" pending={clearing} onClick={() => startClear(async () => {
            const r = await clearRouteCache();
            if (r.ok) toast.success(r.message ?? "Cache vidé"); else toast.error(r.error);
          })}>Vider le cache d’itinéraires</Button>
        </CardBody>
      </Card>
    </div>
  );
}

export function SecurityForms() {
  const [pending, start] = React.useTransition();
  const [others, startOthers] = React.useTransition();
  const [out, startOut] = React.useTransition();
  const [v, setV] = React.useState({ password: "", confirm: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Changer le mot de passe" description="8 caractères minimum, avec au moins une lettre et un chiffre." />
        <CardBody>
          <form className="grid max-w-md gap-4" onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            start(async () => {
              const r = await changePassword(v);
              if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
              setV({ password: "", confirm: "" }); toast.success(r.message ?? "Mot de passe modifié");
            });
          }}>
            <Field id="new_password" label="Nouveau mot de passe" error={errors.password} required>
              <PasswordInput id="new_password" autoComplete="new-password" value={v.password} onChange={(e) => setV((p) => ({ ...p, password: e.target.value }))} />
            </Field>
            <Field id="confirm_password" label="Confirmer le mot de passe" error={errors.confirm} required>
              <PasswordInput id="confirm_password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV((p) => ({ ...p, confirm: e.target.value }))} />
            </Field>
            <div><Button type="submit" pending={pending} disabled={!v.password}>Changer le mot de passe</Button></div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Sessions" />
        <CardBody className="space-y-3">
          <Alert tone="info">La session de ce navigateur est conservée par Supabase Auth. Vous pouvez fermer toutes les autres sessions ouvertes sur d’autres appareils.</Alert>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" pending={others} onClick={() => startOthers(async () => {
              const r = await signOutOtherSessions();
              if (r.ok) toast.success(r.message ?? "Fait"); else toast.error(r.error);
            })}>Fermer les autres sessions</Button>
            <Button variant="outlineDanger" pending={out} onClick={() => startOut(async () => { await logout(); })}>Se déconnecter</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
