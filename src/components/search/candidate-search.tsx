"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Columns2, Download, GitCompare, List, Map as MapIcon, RefreshCw, Route as RouteIcon, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { exportCandidatesCsv } from "@/actions/export";
import { selectStaffForMission } from "@/actions/assignments";
import { estimateRoutes, getRouteGeometry, searchNearby } from "@/actions/search";
import CandidateMap from "@/components/map/candidate-map-lazy";
import { ContactButtons } from "@/components/staff/contact-buttons";
import { AssignmentBadge, AvailabilityBadge, Badge, LocationBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { APP_CONFIG, TRANSPORT_LABELS } from "@/config/app";
import { downloadCsv } from "@/lib/download";
import { formatDistance, formatDuration, type DistanceUnit } from "@/lib/geo/format";
import { rankCandidates, type SortKey } from "@/lib/ranking";
import type { RouteEstimate } from "@/lib/routing/types";
import type { CandidateDTO, NearbyResult, RouteMap, RoutingCapabilitiesDTO, SearchTarget } from "@/lib/search-types";
import type { MissionStatus, TransportMode } from "@/lib/types";
import { cn, formatDateTime, normalizeSkills } from "@/lib/utils";

const MODES: TransportMode[] = ["driving", "walking", "cycling", "public_transport"];
const SORTS: { value: SortKey; label: string }[] = [
  { value: "default", label: "Classement par défaut (dispo → trajet → distance)" },
  { value: "straight_line", label: "Distance à vol d’oiseau" },
  { value: "road_distance", label: "Distance routière" },
  { value: "travel_time", label: "Temps de trajet estimé" },
  { value: "name", label: "Nom" },
];
const ROUTE_BATCH = 8;

export type SearchMission = { id: string; title: string; status: MissionStatus; requiredStaffCount: number; selectedCount: number };

type Props = {
  target: SearchTarget;
  routing: RoutingCapabilitiesDTO;
  mapToken?: string;
  unit: DistanceUnit;
  timeZone: string;
  defaults: { radiusKm: number; availability: "available" | "all"; mode: TransportMode };
  /** Présent uniquement pour la recherche liée à une mission : active la sélection. */
  mission?: SearchMission;
  referenceLabel?: string;
};

function RouteInfo({ route, loading, unit, supported }: { route?: RouteEstimate; loading: boolean; unit: DistanceUnit; supported: boolean }) {
  if (!supported) return <p className="text-sm text-muted">Estimation indisponible pour ce mode de transport.</p>;
  if (!route) return <p className="text-sm text-muted">{loading ? "Calcul de l’itinéraire…" : "Itinéraire non calculé"}</p>;
  if (route.status === "ok") {
    return (
      <div className="text-sm">
        <p><span className="text-muted">Distance routière :</span> <strong>{formatDistance(route.distanceM, unit)}</strong></p>
        <p><span className="text-muted">Temps de trajet estimé :</span> <strong>{formatDuration(route.durationS)}</strong></p>
        <p className="text-xs text-muted">{route.provider} · calculé le {formatDateTime(route.estimatedAt)}{route.source === "cache" ? " (cache)" : ""}</p>
      </div>
    );
  }
  if (route.status === "approximate") {
    return (
      <div className="text-sm">
        <p><span className="text-muted">Estimation approximative :</span> <strong>≈ {formatDuration(route.durationS)}</strong></p>
        <p className="text-xs text-warning">Vitesse moyenne sur {route.basis === "straight_line" ? "la distance à vol d’oiseau" : "la distance routière"} — ce n’est pas un itinéraire réel.</p>
      </div>
    );
  }
  return (
    <div className="text-sm">
      <p className="font-medium">Temps de trajet indisponible</p>
      <p className="text-xs text-muted">{route.message}</p>
    </div>
  );
}

export function CandidateSearch({ target, routing, mapToken, unit, timeZone, defaults, mission, referenceLabel }: Props) {
  const router = useRouter();
  const [radiusKm, setRadiusKm] = React.useState<number>(defaults.radiusKm);
  const [availability, setAvailability] = React.useState<"available" | "all">(defaults.availability);
  const [skillsText, setSkillsText] = React.useState("");
  const [maxResults, setMaxResults] = React.useState<number>(50);
  const [mode, setMode] = React.useState<TransportMode>(routing.supportedModes.includes(defaults.mode) ? defaults.mode : routing.supportedModes[0] ?? "driving");
  const [sort, setSort] = React.useState<SortKey>("default");
  const [view, setView] = React.useState<"split" | "list" | "map">("split");

  const [result, setResult] = React.useState<NearbyResult | null>(null);
  const [searching, setSearching] = React.useState(true); // une recherche part à l’ouverture
  const [error, setError] = React.useState<string | null>(null);
  const [routes, setRoutes] = React.useState<RouteMap>({});
  const [routesLoading, setRoutesLoading] = React.useState(false);
  const [routeProgress, setRouteProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [routeNotice, setRouteNotice] = React.useState<string | null>(null);

  const [highlightedId, setHighlightedId] = React.useState<string | null>(null);
  const [geometry, setGeometry] = React.useState<[number, number][] | null>(null);
  const [compareIds, setCompareIds] = React.useState<string[]>([]);
  const [selectingId, setSelectingId] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const runId = React.useRef(0);
  const cardRefs = React.useRef(new Map<string, HTMLElement>());
  const modeSupported = routing.supportedModes.includes(mode) && routing.configured;

  const params = React.useMemo(
    () => ({ target, radiusKm, availability, skills: normalizeSkills(skillsText), maxResults }),
    [target, radiusKm, availability, skillsText, maxResults],
  );

  /** Étape 2 : itinéraires réels pour un lot borné de candidats (les plus proches), par petits paquets avec résultats partiels. */
  const loadRoutes = React.useCallback(async (data: NearbyResult, m: TransportMode, refresh: boolean) => {
    const id = ++runId.current;
    setRouteNotice(null);
    if (!routing.configured) { setRouteNotice("Le fournisseur d’itinéraires n’est pas configuré (jeton serveur manquant) : seules les distances à vol d’oiseau sont affichées."); setRoutes({}); return; }
    if (!routing.supportedModes.includes(m)) { setRouteNotice(`Le mode « ${TRANSPORT_LABELS[m]} » n’est pas pris en charge : aucune estimation n’est affichée (un temps de voiture ne serait pas valable).`); setRoutes({}); return; }
    const ids = data.candidates.slice(0, APP_CONFIG.search.maxRouteCandidates).map((c) => c.id);
    if (ids.length === 0) { setRoutes({}); return; }
    setRoutesLoading(true);
    setRouteProgress({ done: 0, total: ids.length });
    setRoutes({});
    let done = 0;
    for (let i = 0; i < ids.length; i += ROUTE_BATCH) {
      const batch = ids.slice(i, i + ROUTE_BATCH);
      const r = await estimateRoutes({ target, staffIds: batch, mode: m, refresh });
      if (id !== runId.current) return; // une recherche plus récente a pris le relais
      if (!r.ok || !r.data) { setRouteNotice(r.ok ? "Réponse vide du service d’itinéraires." : r.error); break; }
      setRoutes((prev) => ({ ...prev, ...r.data!.estimates }));
      done += batch.length;
      setRouteProgress({ done, total: ids.length });
    }
    if (id === runId.current) { setRoutesLoading(false); setRouteProgress(null); }
  }, [routing.configured, routing.supportedModes, target]);

  /** Étape 1 : candidats proches par distance à vol d’oiseau. */
  const applyResult = React.useCallback((r: Awaited<ReturnType<typeof searchNearby>>, refreshRoutes: boolean) => {
    setSearching(false);
    setError(null);
    setGeometry(null);
    setHighlightedId(null);
    setCompareIds([]);
    if (!r.ok || !r.data) { setResult(null); setRoutes({}); setError(r.ok ? "Réponse vide" : r.error); return; }
    setResult(r.data);
    void loadRoutes(r.data, mode, refreshRoutes);
  }, [mode, loadRoutes]);

  const search = (refreshRoutes = false) => {
    setSearching(true);
    void searchNearby(params).then((r) => applyResult(r, refreshRoutes));
  };

  // Recherche automatique à l’ouverture (la cible ne change pas sans remontage du composant : voir `key` côté appelant).
  React.useEffect(() => {
    let alive = true;
    void searchNearby(params).then((r) => { if (alive) applyResult(r, false); });
    return () => { alive = false; };
    // Exécutée une seule fois : les filtres suivants passent par le bouton « Chercher ».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeMode = (m: TransportMode) => {
    setMode(m);
    setGeometry(null);
    // Seules les estimations sont recalculées : les candidats et leurs coordonnées ne changent pas.
    if (result) void loadRoutes(result, m, false);
  };

  const ranked = React.useMemo(() => {
    if (!result) return [];
    return rankCandidates(result.candidates.map((c) => ({ ...c, route: routes[c.id] })), sort);
  }, [result, routes, sort]);

  const selectedCount = mission ? mission.selectedCount : 0;
  const missionClosed = mission ? mission.status === "cancelled" || mission.status === "completed" : true;

  const highlight = (id: string | null, scroll = false) => {
    setHighlightedId(id);
    setGeometry(null);
    if (id && scroll) cardRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const select = async (c: CandidateDTO) => {
    if (!mission) return;
    setSelectingId(c.id);
    const r = await selectStaffForMission(mission.id, c.id);
    setSelectingId(null);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(r.message ?? "Sélectionné");
    setResult((prev) => prev && { ...prev, candidates: prev.candidates.map((x) => x.id === c.id ? { ...x, assignment: { id: r.data!.assignmentId, status: "selected" } } : x) });
    router.refresh();
  };

  const showRoute = async (c: CandidateDTO) => {
    const r = await getRouteGeometry({ target, staffId: c.id, mode });
    if (!r.ok) { toast.error(r.error); return; }
    if (!r.data?.coordinates) { toast.info("Le fournisseur n’a pas renvoyé de tracé pour ce trajet : seules la distance et la durée sont affichées."); return; }
    setGeometry(r.data.coordinates);
  };

  const exportResults = async () => {
    setExporting(true);
    const r = await exportCandidatesCsv({ params, mode, sort });
    setExporting(false);
    if (!r.ok || !r.data) { toast.error(r.ok ? "Export vide" : r.error); return; }
    downloadCsv(r.data.filename, r.data.csv);
    toast.success(`${r.data.count} candidat(s) exporté(s)`);
  };

  const toggleCompare = (id: string) => setCompareIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? (toast.info("Comparaison limitée à 3 candidats."), prev) : [...prev, id]);
  const compared = ranked.filter((c) => compareIds.includes(c.id));

  const mapCandidates = React.useMemo(
    () => (result?.candidates ?? []).map((c) => ({ id: c.id, name: c.fullName, latitude: c.latitude, longitude: c.longitude, assigned: c.assignment !== null, routeKnown: routes[c.id]?.status === "ok" })),
    [result, routes],
  );

  const originTitle = mission ? mission.title : referenceLabel ?? "Point de référence";
  const showList = view !== "map";
  const showMap = view !== "list";

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-4">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => { e.preventDefault(); search(false); }} aria-label="Filtres de recherche">
            <Field id="radius" label="Rayon de recherche">
              <Select id="radius" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}>
                {APP_CONFIG.search.radiiKm.map((r) => <option key={r} value={r}>{r} km</option>)}
              </Select>
            </Field>
            <Field id="availability" label="Disponibilité" hint="« Inconnue » n’est jamais comptée comme disponible.">
              <Select id="availability" value={availability} onChange={(e) => setAvailability(e.target.value as "available" | "all")}>
                <option value="available">Disponibles uniquement</option>
                <option value="all">Tous les statuts</option>
              </Select>
            </Field>
            <Field id="skills" label="Compétences requises" hint="Séparées par des virgules ; toutes sont exigées.">
              <Input id="skills" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder={mission ? "ex. aide-soignant" : "ex. chauffeur"} autoComplete="off" />
            </Field>
            <Field id="maxResults" label="Résultats maximum">
              <Select id="maxResults" value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))}>
                {APP_CONFIG.search.maxResultsOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
            <Field id="mode" label="Mode de transport">
              <Select id="mode" value={mode} onChange={(e) => changeMode(e.target.value as TransportMode)} aria-describedby="mode-help">
                {MODES.map((m) => {
                  const ok = routing.supportedModes.includes(m);
                  return <option key={m} value={m} disabled={!ok}>{TRANSPORT_LABELS[m]}{ok ? "" : " — non pris en charge"}</option>;
                })}
              </Select>
            </Field>
            <Field id="sort" label="Trier par" className="lg:col-span-2">
              <Select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </Field>
            <div className="flex items-end gap-2">
              <Button type="submit" pending={searching} className="flex-1"><Search className="h-4 w-4" aria-hidden /> Chercher</Button>
            </div>
          </form>
          <p id="mode-help" className="text-xs text-muted">
            {routing.supportedModes.includes("public_transport") ? "" : "Transports en commun : non disponibles (aucun fournisseur d’horaires configuré). "}
            Les coordonnées viennent des codes postaux : distances et durées sont des estimations, pas des garanties.
          </p>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted" aria-live="polite">
          {searching ? "Recherche en cours…" : result ? <>
            <strong className="text-ink">{result.candidates.length}</strong> candidat(s) dans {radiusKm} km de « {originTitle} » ({result.origin.label}).{" "}
            {mission ? <>Sélectionnés : <strong className="text-ink">{selectedCount}</strong> sur {mission.requiredStaffCount}.</> : null}
          </> : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Affichage">
            {([["list", "Liste", List], ["split", "Liste + carte", Columns2], ["map", "Carte", MapIcon]] as const).map(([v, label, Icon]) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn("inline-flex h-9 items-center gap-1.5 px-3 text-sm", view === v ? "bg-primary-soft font-medium text-primary" : "bg-surface hover:bg-bg")}>
                <Icon className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">{label}</span><span className="sr-only sm:hidden">{label}</span>
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" disabled={!result || searching || routesLoading} onClick={() => result && void loadRoutes(result, mode, true)}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Actualiser les itinéraires
          </Button>
          <Button variant="secondary" size="sm" pending={exporting} disabled={!result || result.candidates.length === 0} onClick={exportResults}>
            {!exporting ? <Download className="h-4 w-4" aria-hidden /> : null} Exporter les résultats
          </Button>
        </div>
      </div>

      {error ? <Alert tone="danger" title="Recherche impossible">{error}</Alert> : null}
      {routeNotice ? <Alert tone="warning">{routeNotice}</Alert> : null}
      {routeProgress ? <p className="text-xs text-muted" aria-live="polite">Itinéraires : {routeProgress.done} / {routeProgress.total} calculés (les plus proches d’abord, par lots de {ROUTE_BATCH}).</p> : null}
      {result && result.candidates.length > APP_CONFIG.search.maxRouteCandidates ? (
        <p className="text-xs text-muted">Les itinéraires sont calculés pour les {APP_CONFIG.search.maxRouteCandidates} candidats les plus proches ; les autres affichent « Itinéraire non calculé ».</p>
      ) : null}
      {result?.truncated ? <Alert tone="info">Résultats limités à {maxResults}. Réduisez le rayon ou ajoutez des compétences pour affiner.</Alert> : null}
      {result && result.excludedUnresolved > 0 ? (
        <Alert tone="warning" title={`${result.excludedUnresolved} staff exclu(s) : localisation non vérifiée`}>
          Ces personnes correspondent à vos filtres mais n’ont pas de coordonnées vérifiées. <Link className="underline" href="/staff?location=pending">Résoudre les localisations</Link>
        </Alert>
      ) : null}

      {compared.length >= 2 ? (
        <Card>
          <CardBody className="overflow-x-auto">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Comparaison</h2><Button variant="ghost" size="sm" onClick={() => setCompareIds([])}>Fermer la comparaison</Button></div>
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="py-2 pr-3">Critère</th>{compared.map((c) => <th key={c.id} className="py-2 pr-3 normal-case text-ink">{c.fullName}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                <tr><td className="py-2 pr-3 text-muted">Disponibilité</td>{compared.map((c) => <td key={c.id} className="py-2 pr-3"><AvailabilityBadge status={c.availability} /></td>)}</tr>
                <tr><td className="py-2 pr-3 text-muted">Distance à vol d’oiseau</td>{compared.map((c) => <td key={c.id} className="py-2 pr-3">{formatDistance(c.straightLineM, unit)}</td>)}</tr>
                <tr><td className="py-2 pr-3 text-muted">Distance routière</td>{compared.map((c) => <td key={c.id} className="py-2 pr-3">{c.route?.status === "ok" ? formatDistance(c.route.distanceM, unit) : "Indisponible"}</td>)}</tr>
                <tr><td className="py-2 pr-3 text-muted">Temps de trajet estimé</td>{compared.map((c) => <td key={c.id} className="py-2 pr-3">{c.route?.status === "ok" ? formatDuration(c.route.durationS) : c.route?.status === "approximate" ? `≈ ${formatDuration(c.route.durationS)} (approx.)` : "Indisponible"}</td>)}</tr>
                <tr><td className="py-2 pr-3 text-muted">Compétences</td>{compared.map((c) => <td key={c.id} className="py-2 pr-3">{c.skills.join(", ") || "—"}</td>)}</tr>
                <tr><td className="py-2 pr-3 text-muted">Localisation</td>{compared.map((c) => <td key={c.id} className="py-2 pr-3"><LocationBadge status={c.locationStatus} /></td>)}</tr>
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}

      <div className={cn("grid gap-4", showList && showMap ? "lg:grid-cols-2" : "grid-cols-1")}>
        {showMap ? (
          <div className={cn(showList && "lg:sticky lg:top-4 lg:self-start", showList && "order-first")}>
            {result ? (
              <CandidateMap
                token={mapToken}
                origin={{ latitude: result.origin.latitude, longitude: result.origin.longitude, label: result.origin.label, title: originTitle }}
                radiusKm={radiusKm}
                candidates={mapCandidates}
                highlightedId={highlightedId}
                onMarkerClick={(id) => highlight(id, true)}
                routeCoordinates={geometry}
                className={showList ? "h-[24rem]" : "h-[36rem]"}
              />
            ) : (
              <div className="grid h-[24rem] place-items-center rounded-xl border border-dashed border-line bg-bg text-sm text-muted">La carte s’affiche après une recherche réussie.</div>
            )}
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Légende">
              <li><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#3157d5]" />Staff correspondant</li>
              <li><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#067647]" />Staff sélectionné</li>
              <li><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#b54708]" />Staff mis en évidence</li>
              <li>Cercle : rayon de recherche · Localisations enregistrées, pas de suivi en direct</li>
            </ul>
          </div>
        ) : null}

        {showList ? (
          <div className="space-y-3" aria-label="Résultats">
            {!searching && result && ranked.length === 0 ? (
              <Alert tone="info" title="Aucun candidat dans ce rayon">Élargissez le rayon, passez à « Tous les statuts » ou retirez une compétence.</Alert>
            ) : null}
            {ranked.map((c) => {
              const route = c.route;
              const assigned = c.assignment !== null;
              const isHi = highlightedId === c.id;
              return (
                <article
                  key={c.id} ref={(el) => { if (el) cardRefs.current.set(c.id, el); else cardRefs.current.delete(c.id); }}
                  onClick={() => highlight(isHi ? null : c.id)}
                  className={cn("cursor-pointer rounded-xl border bg-surface p-4 shadow-card transition-colors", isHi ? "border-primary ring-2 ring-primary/30" : "border-line")}
                  aria-current={isHi || undefined}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/staff/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-primary hover:underline">{c.fullName}</Link>
                      <p className="text-xs text-muted">{[c.postalCode, c.city, c.region].filter(Boolean).join(" · ") || c.countryCode}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <AvailabilityBadge status={c.availability} />
                      <LocationBadge status={c.locationStatus} />
                      {c.assignment ? <AssignmentBadge status={c.assignment.status} /> : null}
                    </div>
                  </div>

                  {c.skills.length > 0 ? <div className="mt-2 flex flex-wrap gap-1">{c.skills.map((s) => <Badge key={s} tone="blue">{s}</Badge>)}</div> : null}

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="text-sm">
                      <p><span className="text-muted">À vol d’oiseau :</span> <strong>{formatDistance(c.straightLineM, unit)}</strong></p>
                      <p className="text-xs text-muted">Distance directe, pas la route. Vérifiée le {c.locationUpdatedAt ? formatDateTime(c.locationUpdatedAt, timeZone) : "— (jamais)"}.</p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted">{TRANSPORT_LABELS[mode]}</p>
                      <RouteInfo route={route} loading={routesLoading} unit={unit} supported={modeSupported} />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <ContactButtons phone={c.phone} />
                    <Button variant={compareIds.includes(c.id) ? "primary" : "secondary"} size="sm" aria-pressed={compareIds.includes(c.id)} onClick={() => toggleCompare(c.id)}>
                      <GitCompare className="h-4 w-4" aria-hidden /> Comparer
                    </Button>
                    {isHi && route?.status === "ok" ? <Button variant="secondary" size="sm" onClick={() => void showRoute(c)}><RouteIcon className="h-4 w-4" aria-hidden /> Afficher le tracé</Button> : null}
                    <Link href={`/staff/${c.id}`} className="text-sm text-primary hover:underline">Voir le profil</Link>
                    {mission ? (
                      assigned ? (
                        <span className="ml-auto inline-flex items-center gap-1 text-sm text-success"><Check className="h-4 w-4" aria-hidden /> Déjà sélectionné</span>
                      ) : (
                        <Button size="sm" className="ml-auto" pending={selectingId === c.id} disabled={missionClosed} onClick={() => void select(c)}>
                          {selectingId !== c.id ? <UserPlus className="h-4 w-4" aria-hidden /> : null} Sélectionner pour la mission
                        </Button>
                      )
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>

      <p className="text-xs text-muted">
        Localisations enregistrées dans les fiches (code postal / ville), jamais des positions en direct. Un point de départ approximatif peut donner une route différente de celle qui part du domicile réel.
      </p>
    </div>
  );
}
