"use client";
import * as React from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { GeoJSONSource, Map as MapboxMap, Marker } from "mapbox-gl";
import { circlePolygon } from "@/lib/geo/circle";
import { Layers2, Satellite, Maximize2, Minimize2 } from "lucide-react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { MapNotice } from "./map-notice";

export type MapCandidate = { id: string; name: string; latitude: number; longitude: number; assigned: boolean; routeKnown: boolean };

type Props = {
  token?: string;
  origin: { latitude: number; longitude: number; label: string; title?: string };
  radiusKm: number;
  candidates: MapCandidate[];
  highlightedId: string | null;
  onMarkerClick: (id: string) => void;
  /** Tracé réel renvoyé par le fournisseur, ou null. Jamais construit côté client. */
  routeCoordinates: [number, number][] | null;
  /** Ligne directe pointillée, clairement approximative (ex. train) — jamais présentée comme un itinéraire réel. */
  approxLine?: [number, number][] | null;
  className?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
};

const COLORS = { matching: "#0878c0", assigned: "#0c7c59", highlighted: "#e0a020", origin: "#b3151b" };

export default function CandidateMap({ token, origin, radiusKm, candidates, highlightedId, onMarkerClick, routeCoordinates, approxLine = null, className = "h-[28rem]", expanded = false, onToggleExpand }: Props) {
  const container = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapboxMap | null>(null);
  const markerRef = React.useRef<Marker | null>(null);
  const readyRef = React.useRef(false);
  const clickRef = React.useRef(onMarkerClick);
  const [failed, setFailed] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [mapStyle, setMapStyle] = React.useState<"streets" | "satellite">("streets");
  const { t } = usePreferences();
  React.useEffect(() => { clickRef.current = onMarkerClick; });
  React.useEffect(() => { const id = window.setTimeout(() => mapRef.current?.resize(), 60); return () => window.clearTimeout(id); }, [expanded]);

  const geojson = React.useMemo(() => ({
    type: "FeatureCollection" as const,
    features: candidates.map((c) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [c.longitude, c.latitude] },
      properties: { id: c.id, name: c.name, state: c.id === highlightedId ? "highlighted" : c.assigned ? "assigned" : "matching" },
    })),
  }), [candidates, highlightedId]);

  // Création unique de la carte.
  React.useEffect(() => {
    if (!token || !container.current) return;
    setFailed(false);
    let cancelled = false;
    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (cancelled || !container.current) return;
        mapboxgl.accessToken = token;
        const map = new mapboxgl.Map({ container: container.current, style: mapStyle === "streets" ? "mapbox://styles/mapbox/streets-v12" : "mapbox://styles/mapbox/satellite-streets-v12", center: [origin.longitude, origin.latitude], zoom: 10 });
        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        map.on("error", (e) => { if (!readyRef.current) { console.error("[map]", e.error?.message); setFailed(true); } });

        map.on("load", () => {
          map.addSource("radius", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#0878c0", "fill-opacity": 0.07 } });
          map.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#0878c0", "line-width": 1.5, "line-dasharray": [2, 2] } });

          map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "route-line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#0878c0", "line-width": 5, "line-opacity": 0.9 } });
          map.addSource("route-approx", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "route-approx-line", type: "line", source: "route-approx", layout: { "line-cap": "round" }, paint: { "line-color": "#b3151b", "line-width": 3, "line-dasharray": [1.5, 2] } });

          map.addSource("candidates", { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterRadius: 45, clusterMaxZoom: 13 });
          map.addLayer({ id: "clusters", type: "circle", source: "candidates", filter: ["has", "point_count"], paint: { "circle-color": "#1d3b5c", "circle-opacity": 0.85, "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26] } });
          map.addLayer({ id: "cluster-count", type: "symbol", source: "candidates", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 }, paint: { "text-color": "#ffffff" } });
          map.addLayer({
            id: "points", type: "circle", source: "candidates", filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-radius": ["case", ["==", ["get", "state"], "highlighted"], 11, 8],
              "circle-color": ["match", ["get", "state"], "highlighted", COLORS.highlighted, "assigned", COLORS.assigned, COLORS.matching],
              "circle-stroke-width": 2, "circle-stroke-color": "#ffffff",
            },
          });

          map.on("click", "clusters", (e) => {
            const f = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
            const clusterId = f?.properties?.cluster_id as number | undefined;
            if (clusterId === undefined || !f) return;
            (map.getSource("candidates") as GeoJSONSource).getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err || zoom == null) return;
              map.easeTo({ center: (f.geometry as { coordinates: number[] }).coordinates as [number, number], zoom });
            });
          });
          map.on("click", "points", (e) => {
            const id = e.features?.[0]?.properties?.id as string | undefined;
            if (id) clickRef.current(id);
          });
          for (const layer of ["clusters", "points"]) {
            map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
          }
          readyRef.current = true;
          setReady(true);
        });
      } catch (e) {
        console.error("[map] initialisation impossible", e);
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      readyRef.current = false;
      setReady(false);
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // origin lu uniquement à la création ; ses mises à jour sont traitées ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, mapStyle]);

  // Point de départ (mission ou point de recherche) + cercle de rayon + cadrage.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      markerRef.current?.remove();
      const el = document.createElement("div");
      el.style.cssText = "width:18px;height:18px;border-radius:4px;background:#b3151b;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:rotate(45deg)";
      el.setAttribute("aria-label", origin.title ?? "Lieu de la mission");
      markerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([origin.longitude, origin.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 16 }).setText(`${origin.title ?? "Mission"} — ${origin.label}`))
        .addTo(map);
      const ring = circlePolygon(origin.latitude, origin.longitude, radiusKm);
      (map.getSource("radius") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: ring.length ? [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }] : [] });
      if (ring.length) {
        const b = new mapboxgl.LngLatBounds();
        for (const p of ring) b.extend(p);
        map.fitBounds(b, { padding: 40, duration: 500, maxZoom: 14 });
      }
    })();
  }, [ready, origin.latitude, origin.longitude, origin.label, origin.title, radiusKm]);

  React.useEffect(() => {
    if (!ready) return;
    (mapRef.current?.getSource("candidates") as GeoJSONSource | undefined)?.setData(geojson);
  }, [ready, geojson]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const line = (c: [number, number][] | null | undefined) => ({
      type: "FeatureCollection" as const,
      features: c && c.length > 1 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: c } }] : [],
    });
    (map.getSource("route") as GeoJSONSource | undefined)?.setData(line(routeCoordinates));
    (map.getSource("route-approx") as GeoJSONSource | undefined)?.setData(line(approxLine));
    const pts = routeCoordinates && routeCoordinates.length > 1 ? routeCoordinates : approxLine && approxLine.length > 1 ? approxLine : null;
    if (pts) {
      (async () => {
        const mapboxgl = (await import("mapbox-gl")).default;
        const b = new mapboxgl.LngLatBounds();
        for (const p of pts) b.extend(p);
        map.fitBounds(b, { padding: 60, duration: 600, maxZoom: 15 });
      })();
    }
  }, [ready, routeCoordinates, approxLine]);

  if (!token || failed) return <MapNotice className={className} />;

  return (
    <div className="relative">
      <div ref={container} className={`w-full overflow-hidden rounded-xl border border-line ${className}`} role="application" aria-label={t("Carte des candidats", "Candidate map")} />
      <div className="absolute left-3 top-3 flex items-center gap-1 rounded-xl border border-line bg-surface/95 p-1 shadow-card"><button type="button" onClick={() => setMapStyle("streets")} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold ${mapStyle === "streets" ? "bg-primary-soft text-primary" : "text-muted hover:bg-bg"}`}><Layers2 className="h-3.5 w-3.5" />{t("Rues", "Streets")}</button><button type="button" onClick={() => setMapStyle("satellite")} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold ${mapStyle === "satellite" ? "bg-primary-soft text-primary" : "text-muted hover:bg-bg"}`}><Satellite className="h-3.5 w-3.5" />Satellite</button>{onToggleExpand ? <button type="button" onClick={onToggleExpand} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-bg hover:text-ink" aria-label={expanded ? t("Réduire la carte", "Collapse map") : t("Agrandir la carte", "Expand map")} title={expanded ? t("Réduire la carte", "Collapse map") : t("Agrandir la carte", "Expand map")}>{expanded ? <Minimize2 className="h-4 w-4"/> : <Maximize2 className="h-4 w-4"/>}</button> : null}</div>
      <div className="pointer-events-none absolute bottom-3 left-3 space-y-1 rounded-lg bg-surface/95 px-3 py-2 text-xs shadow-card" aria-label={t("Légende", "Legend")}>
        <Legend color={COLORS.origin} label={t("Lieu de la mission", "Assignment location")} square />
        <Legend color={COLORS.matching} label={t("Candidat (lieu enregistré)", "Candidate (saved location)")} />
        <Legend color={COLORS.assigned} label={t("Déjà sélectionné", "Already selected")} />
        <Legend color={COLORS.highlighted} label={t("Candidat sélectionné", "Highlighted candidate")} />
      </div>
      <p className="pointer-events-none absolute right-3 top-3 rounded bg-surface/95 px-2 py-1 text-xs font-medium shadow-card">{candidates.length} {t("sur la carte", "on map")}</p>
    </div>
  );
}

function Legend({ color, label, square }: { color: string; label: string; square?: boolean }) {
  return (
    <p className="flex items-center gap-2">
      <span className="inline-block h-3 w-3 border border-white shadow-sm" style={{ background: color, borderRadius: square ? 2 : 999 }} aria-hidden />
      {label}
    </p>
  );
}
