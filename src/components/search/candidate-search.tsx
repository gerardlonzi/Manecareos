"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bike, Car, Check, Download, Footprints, Loader2, MapPin, SlidersHorizontal, TrainFront, UserPlus, X, Clock3, Building2, Search } from "lucide-react";
import { toast } from "sonner";

import { exportCandidatesCsv } from "@/actions/export";
import { selectStaffForMission } from "@/actions/assignments";
import { describeIssue } from "@/lib/assignment-guard";
import { estimateRoutes, getTravelOptions, searchNearby, type TravelOptions } from "@/actions/search";
import CandidateMap from "@/components/map/candidate-map-lazy";
import { ContactButtons } from "@/components/staff/contact-buttons";
import { ComplianceBadge, complianceDetails } from "@/components/staff/compliance-badge";
import { HoursEditor } from "@/components/staff/hours-editor";
import { SkillChips, SkillPicker } from "@/components/staff/skill-picker";
import { usePreferences } from "@/components/providers/preferences-provider";
import { AssignmentBadge, AvailabilityBadge, Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/ui/flag";
import { Input } from "@/components/ui/form";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { APP_CONFIG } from "@/config/app";
import { downloadCsv } from "@/lib/download";
import { formatDistance, formatDuration, type DistanceUnit } from "@/lib/geo/format";
import { groupByTown } from "@/lib/neighbours";
import { rankCandidates, type SortKey } from "@/lib/ranking";
import type { RouteEstimate } from "@/lib/routing/types";
import type { CandidateDTO, NearbyResult, RouteMap, RoutingCapabilitiesDTO, SearchTarget } from "@/lib/search-types";
import type { MissionStatus, TransportMode } from "@/lib/types";
import { cn, normalizeSkills } from "@/lib/utils";

const MODES: TransportMode[] = ["walking", "cycling", "driving", "public_transport"];
const ROUTE_BATCH = 8;
const AUTO_RADII = [50, 100];
/** En deçà de ce rayon autour du point de recherche, un candidat compte comme « sur place » même si sa ville diffère. */
const SAME_TOWN_RADIUS_M = 3000;

export type SearchMission = { id: string; title: string; status: MissionStatus; requiredStaffCount: number; selectedCount: number };

type Props = {
  target: SearchTarget;
  routing: RoutingCapabilitiesDTO;
  mapToken?: string;
  unit: DistanceUnit;
  timeZone: string;
  defaults: { radiusKm: number; availability: "available" | "all"; mode: TransportMode };
  mission?: SearchMission;
  /** Ville du point de recherche (sert à séparer « même ville » et « villes voisines »). */
  originCity?: string | null;
  originLabel?: string;
  /** Mode « carte partagée » (page Find Staff) : aucune carte ici, l’état est transmis à la grande carte du parent. */
  onMapState?: (state: SharedMapState | null) => void;
};

export type SharedMapState = {
  origin: { latitude: number; longitude: number; label: string; title?: string };
  radiusKm: number;
  candidates: { id: string; name: string; latitude: number; longitude: number; assigned: boolean; routeKnown: boolean; unavailable: boolean }[];
  highlightedId: string | null;
  onMarkerClick: (id: string) => void;
  routeCoordinates: [number, number][] | null;
  approxLine: [number, number][] | null;
};

const MODE_ICON = { walking: Footprints, cycling: Bike, driving: Car, public_transport: TrainFront } as const;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "");

export function CandidateSearch({ target, routing, mapToken, unit, defaults, mission, originCity, originLabel, onMapState }: Props) {
  const router = useRouter();
  const { t, tm, locale } = usePreferences();
  const dist = React.useCallback((m: number | null | undefined, u: DistanceUnit = unit) => { const s = formatDistance(m, u); return locale === "en" ? s.replace(",", ".") : s; }, [unit, locale]);
  const modeLabel: Record<TransportMode, string> = { walking: t("À pied", "On foot"), cycling: t("À vélo", "By bike"), driving: t("En voiture", "By car"), public_transport: t("En train", "By train") };

  const [userRadiusKm, setUserRadiusKm] = React.useState(defaults.radiusKm);
  // Élargissement automatique : si personne n’habite sur place, on cherche tout de suite dans les villes alentour (50 puis 100 km).
  const [autoRadius, setAutoRadius] = React.useState<number | null>(null);
  const manualRadius = React.useRef(false);
  const radiusKm = autoRadius ?? userRadiusKm;
  const setRadiusKm = (km: number) => { manualRadius.current = true; setAutoRadius(null); setUserRadiusKm(km); };
  const [availability, setAvailability] = React.useState<"available" | "all">(defaults.availability);
  const [skillsText, setSkillsText] = React.useState("");
  const [maxResults, setMaxResults] = React.useState(50);
  const [sort, setSort] = React.useState<SortKey>("straight_line");
  const [neighbours, setNeighbours] = React.useState(true);
  const [textFilter, setTextFilter] = React.useState("");
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const [result, setResult] = React.useState<NearbyResult | null>(null);
  const [searching, setSearching] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [routes, setRoutes] = React.useState<RouteMap>({});
  const [listMode, setListMode] = React.useState<TransportMode>(routing.supportedModes.includes(defaults.mode) ? defaults.mode : routing.supportedModes[0] ?? "driving");
  const [highlightedId, setHighlightedId] = React.useState<string | null>(null);
  const [travel, setTravel] = React.useState<TravelOptions | null>(null);
  const [travelLoading, setTravelLoading] = React.useState(false);
  const [routeMode, setRouteMode] = React.useState<TransportMode>("driving");
  const [selectingId, setSelectingId] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const searchId = React.useRef(0);
  const routeRun = React.useRef(0);
  const travelRun = React.useRef(0);
  const rowRefs = React.useRef(new Map<string, HTMLElement>());

  const params = React.useMemo(() => ({ target, radiusKm, availability, skills: normalizeSkills(skillsText), maxResults }), [target, radiusKm, availability, skillsText, maxResults]);

  /** Durées réelles (mode du classement) pour les premiers candidats, par lots. Facultatif : la liste s’affiche déjà sans. */
  const loadRoutes = React.useCallback(async (data: NearbyResult, mode: TransportMode) => {
    const run = ++routeRun.current;
    setRoutes({});
    if (!routing.configured || !routing.supportedModes.includes(mode)) return;
    const ids = data.candidates.slice(0, APP_CONFIG.search.maxRouteCandidates).map((c) => c.id);
    for (let i = 0; i < ids.length; i += ROUTE_BATCH) {
      const response = await estimateRoutes({ target, staffIds: ids.slice(i, i + ROUTE_BATCH), mode });
      if (run !== routeRun.current) return;
      if (!response.ok || !response.data) break;
      setRoutes((prev) => ({ ...prev, ...response.data!.estimates }));
    }
  }, [routing.configured, routing.supportedModes, target]);

  // Recherche en direct : chaque changement de filtre relance la recherche (anti-rebond 300 ms).
  React.useEffect(() => {
    const id = ++searchId.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearching(true);
    const timer = window.setTimeout(() => {
      void searchNearby(params).then((response) => {
        if (id !== searchId.current) return;
        setSearching(false);
        if (!response.ok || !response.data) { setResult(null); setError(tm(response.ok ? "Aucun résultat n’a été renvoyé. Réessayez." : response.error)); return; }
        // Aucun staff sur place (ou presque) : on élargit automatiquement le rayon, sans que l’utilisateur ait à ouvrir les filtres.
        if (!manualRadius.current) {
          const onSite = groupByTown(response.data.candidates, { originCity, sameTownRadiusM: SAME_TOWN_RADIUS_M }).sameTown.length;
          const next = AUTO_RADII.find((k) => k > params.radiusKm);
          if (onSite === 0 && response.data.candidates.length < 5 && next !== undefined && !response.data.truncated) { setAutoRadius(next); return; }
        }
        setError(null); setResult(response.data); setHighlightedId(null); setTravel(null);
        void loadRoutes(response.data, listMode);
      });
    }, 300);
    return () => window.clearTimeout(timer);
    // listMode et loadRoutes : volontairement hors dépendances (le mode de la liste ne relance pas la recherche).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  React.useEffect(() => () => { searchId.current++; routeRun.current++; travelRun.current++; }, []);

  const changeListMode = (m: TransportMode) => { setListMode(m); if (result) void loadRoutes(result, m); };

  const visible = React.useMemo(() => {
    if (!result) return [];
    const q = norm(textFilter.trim());
    const withRoutes = result.candidates.map((c) => ({ ...c, route: routes[c.id] }));
    return q ? withRoutes.filter((c) => norm(`${c.fullName} ${c.staffCode ?? ""} ${c.city ?? ""} ${c.postalCode ?? ""} ${c.region ?? ""}`).includes(q)) : withRoutes;
  }, [result, routes, textFilter]);

  const grouped = React.useMemo(() => {
    const g = groupByTown(visible, { originCity, sameTownRadiusM: SAME_TOWN_RADIUS_M });
    return { sameTown: rankCandidates(g.sameTown, sort), towns: g.towns.map((town) => ({ ...town, items: rankCandidates(town.items, sort) })) };
  }, [visible, originCity, sort]);

  const neighbourCount = grouped.towns.reduce((n, g) => n + g.items.length, 0);
  const shown = neighbours ? [...grouped.sameTown, ...grouped.towns.flatMap((g) => g.items)] : grouped.sameTown;

  const missionClosed = mission ? mission.status === "cancelled" || mission.status === "completed" : true;

  const open = async (c: CandidateDTO) => {
    if (highlightedId === c.id) { setHighlightedId(null); setTravel(null); return; }
    setHighlightedId(c.id);
    setTravel(null);
    setTravelLoading(true);
    const run = ++travelRun.current;
    const response = await getTravelOptions({ target, staffId: c.id });
    if (run !== travelRun.current) return;
    setTravelLoading(false);
    if (!response.ok || !response.data) { toast.error(tm(response.ok ? "Itinéraire indisponible." : response.error)); return; }
    setTravel(response.data);
    const preferred = [listMode, "driving", "walking", "cycling"].find((m) => response.data!.geometry[m as "driving" | "walking" | "cycling"]);
    setRouteMode((preferred as TransportMode | undefined) ?? "driving");
  };

  const focusFromMap = (id: string) => {
    const c = result?.candidates.find((x) => x.id === id);
    if (c) { void open(c); rowRefs.current.get(id)?.scrollIntoView({ block: "center", behavior: "smooth" }); }
  };

  const origin = result?.origin;
  const hi = highlightedId ? result?.candidates.find((c) => c.id === highlightedId) : undefined;
  const realGeometry = travel && routeMode !== "public_transport" ? travel.geometry[routeMode] ?? null : null;
  const approxLine: [number, number][] | null = travel && hi && origin && routeMode === "public_transport" ? [[hi.longitude, hi.latitude], [origin.longitude, origin.latitude]] : null;

  const select = async (c: CandidateDTO) => {
    if (!mission) return;
    setSelectingId(c.id);
    let response = await selectStaffForMission(mission.id, c.id);
    if (!response.ok && response.issues?.length && !response.issues.some((i) => i.level === "block")) {
      const text = response.issues.map((i) => `• ${describeIssue(i, locale)}`).join("\n");
      if (window.confirm(`${t("Points d’attention :", "Warnings:")}\n${text}\n\n${t("Attribuer quand même ?", "Assign anyway?")}`)) response = await selectStaffForMission(mission.id, c.id, true);
    }
    setSelectingId(null);
    if (!response.ok && response.issues?.length) { toast.error(response.issues.map((i) => describeIssue(i, locale)).join(" ")); return; }
    if (!response.ok) { toast.error(tm(response.error)); return; }
    toast.success(tm(response.message ?? "Sélectionné"));
    setResult((prev) => prev ? { ...prev, candidates: prev.candidates.map((x) => x.id === c.id ? { ...x, assignment: { id: response.data!.assignmentId, status: "selected" } } : x) } : prev);
    router.refresh();
  };

  const exportResults = async () => {
    setExporting(true);
    try {
      const r = await exportCandidatesCsv({ params, mode: listMode, sort });
      if (!r.ok || !r.data) { toast.error(tm(r.ok ? "Aucune donnée à exporter." : r.error)); return; }
      downloadCsv(r.data.filename, r.data.csv);
      toast.success(t(`${r.data.count} candidat(s) exporté(s)`, `${r.data.count} candidate(s) exported`));
    } finally { setExporting(false); }
  };

  const row = (c: (typeof shown)[number]) => {
    const active = c.id === highlightedId;
    const r: RouteEstimate | undefined = c.route;
    const incomplete = Boolean(c.compliance && !c.compliance.complete);
    const unavailable = c.availability === "unavailable";
    return (
      <li key={c.id} ref={(el) => { if (el) rowRefs.current.set(c.id, el); else rowRefs.current.delete(c.id); }} className={cn("group/row relative transition-colors", incomplete && !active && "bg-danger-soft/45", active && "bg-primary-soft/60")}>
        {incomplete && c.compliance ? (
          <span role="tooltip" className="pointer-events-none invisible absolute right-3 top-full z-40 -mt-1 w-72 max-w-[80vw] rounded-lg border border-line bg-surface p-3 text-left text-xs leading-5 opacity-0 shadow-[var(--shadow-pop)] transition-opacity group-hover/row:visible group-hover/row:opacity-100">
            <strong className="mb-1 block text-[11px] uppercase tracking-wide text-muted">{t("Dossier de conformité", "Compliance file")}</strong>
            <ul className="list-disc space-y-0.5 pl-4">{complianceDetails(c.compliance, locale).map((d) => <li key={d}>{d}</li>)}</ul>
            <span className="mt-1.5 block font-medium text-danger">{t("Ne peut pas être attribué à une mission.", "Cannot be assigned to an assignment.")}</span>
          </span>
        ) : null}
        <button type="button" onClick={() => void open(c)} aria-expanded={active} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-primary-soft/40">
          <Avatar name={c.fullName} photoUrl={c.photoUrl} size={36} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{c.fullName}</span>{unavailable ? <Badge tone="red" className="shrink-0"><span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden />{t("Indisponible", "Unavailable")}</Badge> : null}{incomplete ? <span className="shrink-0"><ComplianceBadge compliance={c.compliance!} tip={false} /></span> : null}{c.assignment ? <AssignmentBadge status={c.assignment.status} /> : null}</span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
              <Flag code={c.countryCode} region={c.region} />
              <span className="truncate">{c.city ?? "—"}</span>
              {c.postalCode ? <span className="rounded bg-surface-2 px-1 font-mono ring-1 ring-line">{c.postalCode}</span> : null}
              {c.weeklyHours != null ? (() => { const left = Math.round((c.weeklyHours - c.weekUsed) * 100) / 100; return <span className={cn("hidden items-center gap-0.5 sm:inline-flex", left <= 0 ? "font-semibold text-danger" : left <= 4 ? "font-medium text-warning" : "")} title={t(`${Math.round(c.weekUsed * 100) / 100} h utilisées sur ${c.weeklyHours} h cette semaine`, `${Math.round(c.weekUsed * 100) / 100} h used out of ${c.weeklyHours} h this week`)}><Clock3 className="h-3 w-3" aria-hidden />{left > 0 ? t(`${left} h restantes`, `${left} h left`) : left === 0 ? t("complet", "full") : t(`+${-left} h en trop`, `${-left} h over`)}</span>; })() : <span className="hidden text-[11px] sm:inline">{t("heures non définies", "hours not set")}</span>}
            </span>
          </span>
          <span className="hidden shrink-0 md:block"><SkillChips skills={c.skills} max={2} /></span>
          <span className="shrink-0 text-right">
            <span className="block text-sm font-semibold tabular-nums">{dist(c.straightLineM)}</span>
            {r && r.status === "ok" ? <span className="block text-[11px] tabular-nums text-muted">{formatDuration(r.durationS)}</span> : null}
          </span>
        </button>

        {active ? (
          <div className="anim-fade space-y-3 border-t border-line/70 px-4 pb-4 pt-3">
            {unavailable ? <p role="status" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{t("Ce staff est marqué comme indisponible. Vous pouvez le consulter, mais l’attribution demandera une confirmation.", "This staff member is marked as unavailable. You can view them, but assigning will ask for confirmation.")}</p> : null}
            {incomplete && c.compliance ? <div className="rounded-lg border border-danger/30 bg-danger-soft/60 px-3 py-2 text-xs"><ul className="list-disc space-y-0.5 pl-4">{complianceDetails(c.compliance, locale).map((d) => <li key={d}>{d}</li>)}</ul><Link href={`/staff/${c.id}/edit#documents`} className="mt-1 inline-block font-medium text-primary hover:underline">{t("Compléter les documents", "Complete the documents")}</Link></div> : null}
            <div className="flex flex-wrap items-center gap-3 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Heures / semaine", "Hours / week")}</span><HoursEditor staffId={c.id} cap={c.weeklyHours} used={c.weekUsed} onSaved={(v) => setResult((prev) => prev ? { ...prev, candidates: prev.candidates.map((x) => x.id === c.id ? { ...x, weeklyHours: v } : x) } : prev)} /></div>
            <div className="flex flex-wrap items-center gap-2"><AvailabilityBadge status={c.availability} />{c.staffCode ? <span className="font-mono text-xs text-muted">{c.staffCode}</span> : null}<span className="md:hidden"><SkillChips skills={c.skills} max={3} /></span></div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("Trajet jusqu’au point de recherche", "Journey to the search point")}</p>
              {travelLoading ? <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t("Calcul des itinéraires…", "Computing journeys…")}</p> : null}
              {travel ? (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label={t("Mode de transport", "Transport mode")}>
                    {MODES.map((m) => {
                      const Icon = MODE_ICON[m];
                      const est = travel.options[m];
                      const ok = est && (est.status === "ok" || est.status === "approximate");
                      const train = m === "public_transport";
                      const selectedTab = routeMode === m;
                      const hasLine = train ? true : Boolean(travel.geometry[m as "driving" | "walking" | "cycling"]);
                      return (
                        <button key={m} type="button" role="tab" aria-selected={selectedTab} onClick={() => setRouteMode(m)}
                          className={cn("rounded-lg border p-2.5 text-left", selectedTab ? "border-primary bg-surface ring-2 ring-primary/20" : "border-line bg-surface hover:border-primary/40")}>
                          <span className="flex items-center gap-1.5 text-xs font-semibold"><Icon className="h-4 w-4 text-primary" aria-hidden />{modeLabel[m]}</span>
                          {ok ? (
                            <>
                              <span className="mt-1 block text-sm font-semibold tabular-nums">{est.status === "approximate" ? "≈ " : ""}{formatDuration(est.durationS)}</span>
                              <span className="block text-[11px] tabular-nums text-muted">{dist(est.distanceM)}{!hasLine && !train ? ` · ${t("sans tracé", "no line")}` : ""}</span>
                            </>
                          ) : <span className="mt-1 block text-xs text-muted">{t("Indisponible", "Unavailable")}</span>}
                          {train && ok ? <span className="mt-0.5 block text-[10px] font-medium text-warning">{t("estimation", "estimate")}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                  {routeMode !== "public_transport" && travel.options[routeMode]?.status === "approximate" ? (
                    <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">{t("Estimation approximative : distance à vol d’oiseau corrigée et vitesse moyenne supposée (aucun itinéraire réel disponible pour ce mode).", "Approximate estimate: straight-line distance with a detour factor and an assumed average speed (no real route available for this mode).")}</p>
                  ) : null}
                  {routeMode === "public_transport" ? (
                    <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">{t(`Durée en train estimée à vitesse moyenne supposée (${APP_CONFIG.routing.trainSpeedKmh} km/h + ${APP_CONFIG.routing.trainOverheadMinutes} min d’attente), sans horaire réel. Ligne pointillée = trajet direct approximatif.`, `Train time is estimated from an assumed average speed (${APP_CONFIG.routing.trainSpeedKmh} km/h + ${APP_CONFIG.routing.trainOverheadMinutes} min waiting), not a real timetable. Dotted line = approximate direct path.`)}</p>
                  ) : !realGeometry ? (
                    <p className="mt-2 text-xs text-muted">{routing.configured ? t("Le fournisseur n’a pas renvoyé de tracé pour ce mode.", "The provider returned no route line for this mode.") : t("Tracé indisponible : clé de cartographie absente.", "Route line unavailable: no mapping key configured.")}</p>
                  ) : null}
                  <p className="mt-1.5 text-[11px] text-muted">{t("Distance à vol d’oiseau", "Straight-line distance")} : {dist(travel.straightLineM)}</p>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ContactButtons phone={c.phone} />
              {mission && !c.assignment && !missionClosed ? <Button size="sm" pending={selectingId === c.id} disabled={incomplete} title={incomplete ? t("Documents obligatoires manquants ou expirés", "Mandatory documents missing or expired") : undefined} onClick={() => void select(c)}><UserPlus className="h-4 w-4" aria-hidden />{t("Sélectionner pour la mission", "Select for assignment")}</Button> : null}
              {c.assignment ? <span className="inline-flex items-center gap-1 text-xs text-success"><Check className="h-4 w-4" aria-hidden />{t("Déjà sélectionné", "Already selected")}</span> : null}
              <Link href={`/staff/${c.id}`} className="ml-auto text-sm font-medium text-primary hover:underline">{t("Voir la fiche", "View profile")}</Link>
            </div>
          </div>
        ) : null}
      </li>
    );
  };

  const mapCandidates = shown.map((c) => ({ id: c.id, name: c.fullName, latitude: c.latitude, longitude: c.longitude, assigned: Boolean(c.assignment), routeKnown: Boolean(c.route), unavailable: c.availability === "unavailable" }));

  // Carte partagée : on transmet l’état (marqueurs, tracé, point de recherche) à la carte unique du parent.
  const focusRef = React.useRef(focusFromMap);
  React.useEffect(() => { focusRef.current = focusFromMap; });
  const sharedKey = JSON.stringify([origin?.latitude, origin?.longitude, radiusKm, highlightedId, mapCandidates.map((c) => `${c.id}${c.assigned ? 1 : 0}${c.routeKnown ? 1 : 0}${c.unavailable ? 1 : 0}`), realGeometry?.length ?? 0, realGeometry?.[0], approxLine?.[0]]);
  const latest = React.useRef({ origin, radiusKm, mapCandidates, highlightedId, realGeometry, approxLine, title: mission?.title ?? t("Point de recherche", "Search point") });
  React.useEffect(() => { latest.current = { origin, radiusKm, mapCandidates, highlightedId, realGeometry, approxLine, title: mission?.title ?? t("Point de recherche", "Search point") }; });
  React.useEffect(() => {
    if (!onMapState) return;
    const l = latest.current;
    onMapState(l.origin ? { origin: { latitude: l.origin.latitude, longitude: l.origin.longitude, label: l.origin.label, title: l.title }, radiusKm: l.radiusKm, candidates: l.mapCandidates, highlightedId: l.highlightedId, onMarkerClick: (id) => focusRef.current(id), routeCoordinates: l.realGeometry, approxLine: l.approxLine } : null);
  }, [sharedKey, onMapState]);
  React.useEffect(() => () => onMapState?.(null), [onMapState]);

  return (
    <div className={onMapState ? "min-w-0" : "grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"}>
      {/* Carte (reste visible pendant le défilement de la liste) */}
      {!onMapState ? <section className="min-w-0 lg:sticky lg:top-[calc(var(--table-top,0px)+0.75rem)]" aria-label={t("Carte", "Map")}>
        {origin ? (
          <CandidateMap token={mapToken} origin={{ latitude: origin.latitude, longitude: origin.longitude, label: origin.label, title: mission?.title ?? t("Point de recherche", "Search point") }}
            radiusKm={radiusKm} candidates={mapCandidates} highlightedId={highlightedId} onMarkerClick={focusFromMap}
            routeCoordinates={realGeometry} approxLine={approxLine} className="h-[45vh] min-h-[320px] lg:h-[calc(100dvh-var(--table-top,0px)-2rem)]" />
        ) : (
          <div className="grid h-[45vh] min-h-[320px] place-items-center rounded-xl border border-line bg-surface text-sm text-muted">{searching ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : t("Carte indisponible.", "Map unavailable.")}</div>
        )}
      </section> : null}

      {/* Liste */}
      <section className="min-w-0 space-y-3" aria-label={t("Résultats", "Results")}>
        <div className="card-surface space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold">{searching ? <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden /> : <MapPin className="h-4 w-4 text-primary" aria-hidden />}
                {searching ? t("Recherche…", "Searching…") : t(`${shown.length} personne(s)`, `${shown.length} people`)}</p>
              <p className="truncate text-xs text-muted">{originLabel ?? origin?.label} · {t("rayon", "radius")} {radiusKm} km{mission ? ` · ${t("sélectionnés", "selected")} ${mission.selectedCount}/${mission.requiredStaffCount}` : ""}</p>
            </div>
            <Button size="sm" variant={filtersOpen ? "soft" : "secondary"} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}><SlidersHorizontal className="h-4 w-4" aria-hidden />{t("Filtres", "Filters")}</Button>
            <Button size="sm" variant="secondary" pending={exporting} disabled={!result || result.candidates.length === 0} onClick={() => void exportResults()}><Download className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">{t("Exporter", "Export")}</span></Button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input value={textFilter} onChange={(e) => setTextFilter(e.target.value)} placeholder={t("Filtrer par code postal, ville ou nom…", "Filter by postcode, city or name…")} aria-label={t("Filtrer les résultats", "Filter results")} className="h-9 pl-9 pr-9" />
            {textFilter ? <button type="button" onClick={() => setTextFilter("")} aria-label={t("Effacer", "Clear")} className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted hover:bg-primary-soft"><X className="h-3.5 w-3.5" aria-hidden /></button> : null}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
            <input type="checkbox" checked={neighbours} onChange={(e) => setNeighbours(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" />
            <span className="text-sm"><span className="flex items-center gap-1.5 font-medium"><Building2 className="h-4 w-4 text-primary" aria-hidden />{t("Inclure les villes voisines", "Include neighbouring towns")}</span><span className="block text-xs text-muted">{t("Affiche aussi le staff qui habite dans les villes autour, avec le nom de la ville et la distance en km.", "Also shows staff living in nearby towns, with the town name and distance in km.")}</span></span>
          </label>

          {filtersOpen ? (
            <div className="anim-fade grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
              <div><span className="mb-1.5 block text-xs font-medium">{t("Rayon", "Radius")}</span>
                <SearchablePicker id="cs-radius" value={String(radiusKm)} onValueChange={(v) => setRadiusKm(Number(v))} options={[...APP_CONFIG.search.radiiKm, 75, 100].map((k) => ({ value: String(k), label: `${k} km` }))} /></div>
              <div><span className="mb-1.5 block text-xs font-medium">{t("Disponibilité", "Availability")}</span>
                <SearchablePicker id="cs-avail" value={availability} onValueChange={(v) => setAvailability(v as "available" | "all")} options={[{ value: "available", label: t("Disponibles uniquement", "Available only") }, { value: "all", label: t("Tous (hors archivés)", "Everyone (not archived)") }]} /></div>
              <div><span className="mb-1.5 block text-xs font-medium">{t("Trier par", "Sort by")}</span>
                <SearchablePicker id="cs-sort" value={sort} onValueChange={(v) => setSort(v as SortKey)} options={[{ value: "straight_line", label: t("Distance à vol d’oiseau", "Straight-line distance") }, { value: "default", label: t("Classement par défaut", "Default ranking") }, { value: "travel_time", label: t("Temps de trajet", "Travel time") }, { value: "road_distance", label: t("Distance routière", "Road distance") }, { value: "name", label: t("Nom", "Name") }]} /></div>
              <div><span className="mb-1.5 block text-xs font-medium">{t("Durée affichée dans la liste", "Time shown in the list")}</span>
                <SearchablePicker id="cs-mode" value={listMode} onValueChange={(v) => changeListMode(v as TransportMode)} options={(["driving", "walking", "cycling"] as TransportMode[]).filter((m) => routing.supportedModes.includes(m)).map((m) => ({ value: m, label: modeLabel[m] }))} /></div>
              <div><span className="mb-1.5 block text-xs font-medium">{t("Nombre maximum", "Maximum results")}</span>
                <SearchablePicker id="cs-max" value={String(maxResults)} onValueChange={(v) => setMaxResults(Number(v))} options={APP_CONFIG.search.maxResultsOptions.map((n) => ({ value: String(n), label: String(n) }))} /></div>
              <div className="sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">{t("Compétences requises", "Required skills")}</span><SkillPicker id="cs-skills" value={skillsText} onChange={setSkillsText} /></div>
            </div>
          ) : null}
        </div>

        {error ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p> : null}
        {result && result.excludedUnresolved > 0 ? <p className="rounded-xl bg-warning-soft px-4 py-3 text-xs text-warning">{t(`${result.excludedUnresolved} personne(s) correspondent mais n’ont pas de localisation vérifiée.`, `${result.excludedUnresolved} matching people have no verified location.`)}</p> : null}
        {result?.truncated ? <p className="text-xs text-muted">{t("Résultats limités au maximum choisi : réduisez le rayon ou les filtres.", "Results capped at the chosen maximum: narrow the radius or filters.")}</p> : null}

        {result && !searching && shown.length === 0 && !error ? (
          <div className="card-surface px-6 py-10 text-center"><MapPin className="mx-auto mb-2 h-6 w-6 text-muted" aria-hidden /><p className="font-semibold">{t("Aucun staff trouvé", "No staff found")}</p><p className="mt-1 text-sm text-muted">{textFilter ? t("Aucun résultat pour ce filtre.", "No results for this filter.") : neighbours ? t("Essayez un rayon plus grand ou « Tous » pour la disponibilité.", "Try a larger radius or “Everyone” for availability.") : t("Activez « villes voisines » ou agrandissez le rayon.", "Turn on “neighbouring towns” or enlarge the radius.")}</p></div>
        ) : null}

        {grouped.sameTown.length > 0 ? (
          <div className="card-surface overflow-hidden">
            <h3 className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted"><span>{originCity ? t(`À ${originCity} et alentours immédiats`, `In and around ${originCity}`) : t("Sur place et alentours immédiats", "On site and immediate surroundings")}</span><Badge tone="blue">{grouped.sameTown.length}</Badge></h3>
            <ul className="divide-y divide-line">{grouped.sameTown.map(row)}</ul>
          </div>
        ) : null}

        {autoRadius && result ? <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">{t(`Aucun staff sur place : rayon élargi automatiquement à ${autoRadius} km. Vous pouvez le modifier dans les filtres.`, `No staff on site: radius automatically widened to ${autoRadius} km. You can change it in the filters.`)}</p> : null}
        {neighbours && grouped.towns.length > 0 ? <h3 className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-[.14em] text-muted">{t("Staff vivant aux alentours", "Staff living nearby")}</h3> : null}
        {neighbours ? grouped.towns.map((g) => (
          <div key={g.town} className="card-surface overflow-hidden">
            <h3 className="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-4 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-semibold"><Building2 className="h-4 w-4 shrink-0 text-primary" aria-hidden /><span className="truncate">{g.town === "Unknown" ? t("Ville inconnue", "Unknown town") : g.town}</span>{g.region ? <span className="hidden truncate text-xs font-normal text-muted sm:inline">· {g.region}</span> : null}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted"><span className="tabular-nums">{t("à partir de", "from")} {dist(g.minDistanceM, "km")}</span><Badge tone="blue">{g.items.length}</Badge></span>
            </h3>
            <ul className="divide-y divide-line">{g.items.map(row)}</ul>
          </div>
        )) : neighbourCount > 0 ? (
          <button type="button" onClick={() => setNeighbours(true)} className="w-full rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted hover:border-primary/40 hover:text-ink">{t(`${neighbourCount} personne(s) dans les villes voisines — afficher`, `${neighbourCount} people in neighbouring towns — show`)}</button>
        ) : null}
      </section>
    </div>
  );
}
