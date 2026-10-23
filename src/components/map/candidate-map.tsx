"use client";
import * as React from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { GeoJSONSource, Map as MapboxMap, Marker } from "mapbox-gl";
import { circlePolygon } from "@/lib/geo/circle";
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
  className?: string;
};

const COLORS = { matching: "#3157d5", assigned: "#067647", highlighted: "#b54708" };

export default function CandidateMap({ token, origin, radiusKm, candidates, highlightedId, onMarkerClick, routeCoordinates, className = "h-[28rem]" }: Props) {
  const container = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapboxMap | null>(null);
  const markerRef = React.useRef<Marker | null>(null);
  const readyRef = React.useRef(false);
  const clickRef = React.useRef(onMarkerClick);
  const [failed, setFailed] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => { clickRef.current = onMarkerClick; });

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
    let cancelled = false;
    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (cancelled || !container.current) return;
        mapboxgl.accessToken = token;
        const map = new mapboxgl.Map({ container: container.current, style: "mapbox://styles/mapbox/streets-v12", center: [origin.longitude, origin.latitude], zoom: 10 });
        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new mapboxgl.FullscreenControl(), "top-right");
        map.on("error", (e) => { if (!readyRef.current) { console.error("[map]", e.error?.message); setFailed(true); } });

        map.on("load", () => {
          map.addSource("radius", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#3157d5", "fill-opacity": 0.07 } });
          map.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#3157d5", "line-width": 1.5, "line-dasharray": [2, 2] } });

          map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "route-line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#172033", "line-width": 4, "line-opacity": 0.8 } });

          map.addSource("candidates", { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterRadius: 45, clusterMaxZoom: 13 });
          map.addLayer({ id: "clusters", type: "circle", source: "candidates", filter: ["has", "point_count"], paint: { "circle-color": "#3157d5", "circle-opacity": 0.85, "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26] } });
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
  }, [token]);

  // Point de départ (mission ou point de recherche) + cercle de rayon + cadrage.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      markerRef.current?.remove();
      const el = document.createElement("div");
      el.style.cssText = "width:18px;height:18px;border-radius:4px;background:#172033;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:rotate(45deg)";
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
    if (!ready) return;
    const src = mapRef.current?.getSource("route") as GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: routeCoordinates && routeCoordinates.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeCoordinates } }] : [],
    });
  }, [ready, routeCoordinates]);

  if (!token || failed) return <MapNotice className={className} />;

  return (
    <div className="relative">
      <div ref={container} className={`w-full overflow-hidden rounded-xl border border-line ${className}`} role="application" aria-label="Carte des candidats" />
      <div className="pointer-events-none absolute bottom-3 left-3 space-y-1 rounded-lg bg-surface/95 px-3 py-2 text-xs shadow-card" aria-label="Légende">
        <Legend color="#172033" label="Lieu de la mission" square />
        <Legend color={COLORS.matching} label="Candidat (localisation enregistrée)" />
        <Legend color={COLORS.assigned} label="Déjà sélectionné" />
        <Legend color={COLORS.highlighted} label="Candidat surligné" />
      </div>
      <p className="pointer-events-none absolute right-3 top-3 rounded bg-surface/95 px-2 py-1 text-xs font-medium shadow-card">{candidates.length} sur la carte</p>
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
