"use client";
import * as React from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { geocodeSearchPoint } from "@/actions/search";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { COUNTRY_LIST } from "@/config/countries";
import type { DistanceUnit } from "@/lib/geo/format";
import type { RoutingCapabilitiesDTO, SearchTarget } from "@/lib/search-types";
import type { TransportMode } from "@/lib/types";
import { CandidateSearch } from "./candidate-search";

type Props = {
  defaultCountry: string;
  routing: RoutingCapabilitiesDTO;
  mapToken?: string;
  unit: DistanceUnit;
  timeZone: string;
  defaults: { radiusKm: number; availability: "available" | "all"; mode: TransportMode };
};

/** Recherche libre : le point saisi (code postal / ville) est un POINT DE RÉFÉRENCE, pas la position de quelqu’un. */
export function FindStaffClient({ defaultCountry, routing, mapToken, unit, timeZone, defaults }: Props) {
  const [country, setCountry] = React.useState(defaultCountry);
  const [postal, setPostal] = React.useState("");
  const [city, setCity] = React.useState("");
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<(SearchTarget & { kind: "point" }) | null>(null);
  const [seq, setSeq] = React.useState(0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!postal.trim() && !city.trim()) { setError("Saisissez un code postal ou une ville."); return; }
    start(async () => {
      const r = await geocodeSearchPoint({ country_code: country, postal_code: postal, city, region: "" });
      if (!r.ok || !r.data) { setError(r.ok ? "Lieu introuvable" : r.fieldErrors ? Object.values(r.fieldErrors)[0] ?? r.error : r.error); setTarget(null); return; }
      setTarget({ kind: "point", latitude: r.data.latitude, longitude: r.data.longitude, label: r.data.label });
      setSeq((n) => n + 1);
      toast.success("Point de référence trouvé");
    });
  };

  const clear = () => { setTarget(null); setPostal(""); setCity(""); setError(null); };

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Point de référence de la recherche">
            <Field id="fs-country" label="Pays">
              <Select id="fs-country" value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRY_LIST.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </Select>
            </Field>
            <Field id="fs-postal" label="Code postal">
              <Input id="fs-postal" value={postal} onChange={(e) => setPostal(e.target.value)} autoComplete="off" />
            </Field>
            <Field id="fs-city" label="Ville">
              <Input id="fs-city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="off" />
            </Field>
            <div className="flex items-end gap-2 lg:col-span-2">
              <Button type="submit" pending={pending}><Search className="h-4 w-4" aria-hidden /> Trouver du staff</Button>
              <Button variant="ghost" onClick={clear}><X className="h-4 w-4" aria-hidden /> Effacer la recherche</Button>
            </div>
          </form>
          {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
        </CardBody>
      </Card>

      {target ? (
        <>
          <Alert tone="info">Point de référence : <strong>{target.label}</strong>. Les distances sont calculées entre ce point et le lieu <em>enregistré</em> de chaque staff, pas leur position en direct.</Alert>
          <CandidateSearch
            key={seq} target={target} routing={routing} mapToken={mapToken} unit={unit} timeZone={timeZone}
            defaults={defaults} referenceLabel={target.label}
          />
        </>
      ) : (
        <Alert tone="info" title="Indiquez un lieu pour commencer">Saisissez un code postal ou une ville : StaffFlow cherche les staff disponibles dont le lieu enregistré se trouve dans le rayon choisi.</Alert>
      )}
    </div>
  );
}
