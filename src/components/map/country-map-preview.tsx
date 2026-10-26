"use client";

import * as React from "react";
import "mapbox-gl/dist/mapbox-gl.css";

import type { Map as MapboxMap } from "mapbox-gl";
import {
  Layers2,
  MapPinned,
  Satellite,
  Maximize2,
  Minimize2,
} from "lucide-react";

import { MapNotice } from "./map-notice";
import { usePreferences } from "@/components/providers/preferences-provider";

const CENTERS: Record<string, [number, number, number]> = {
  GB: [-2.5, 54.2, 5],
  IE: [-8, 53.3, 6],
  FR: [2.2, 46.5, 5],
  DE: [10.4, 51.1, 5],
  ES: [-3.7, 40.2, 5],
  IT: [12.6, 42.8, 5],
  BE: [4.7, 50.6, 7],
  NL: [5.3, 52.1, 7],
  PT: [-8, 39.6, 5.5],
  AT: [14.2, 47.6, 6],
  CH: [8.2, 46.8, 6],
  DK: [9.5, 56.1, 5.5],
  SE: [15, 62, 3.8],
  NO: [9.2, 62.2, 3.8],
  FI: [26, 64, 4],
  PL: [19.1, 52.1, 5],
  CZ: [15.5, 49.8, 6],
  SK: [19.5, 48.7, 6],
  HU: [19.5, 47.2, 6],
  RO: [25, 46, 5],
  BG: [25.3, 42.7, 5.5],
  GR: [22, 39, 5],
  HR: [16.5, 45.3, 6],
  SI: [14.9, 46.1, 6.5],
  BA: [17.8, 44.2, 6],
  RS: [20.8, 44, 6],
  ME: [19.2, 42.7, 7],
  AL: [20, 41.2, 6.5],
  MK: [21.7, 41.6, 7],
  EE: [25.5, 58.7, 6],
  LV: [24.6, 56.9, 6],
  LT: [23.9, 55.2, 6],
  BY: [28, 53.7, 5],
  UA: [31, 49, 4.5],
  MD: [28.5, 47, 6],
  IS: [-19, 65, 4.5],
  LU: [6.1, 49.8, 8],
  LI: [9.55, 47.15, 9],
  MC: [7.4, 43.7, 11],
  AD: [1.6, 42.5, 9],
  MT: [14.4, 35.9, 9],
  CY: [33.3, 35.1, 7],
  TR: [35, 39, 4.5],
  RU: [90, 60, 2.2],
  US: [-98.5, 39.8, 3],
  CA: [-106.3, 56.1, 3],
  CM: [12.35, 5.7, 5],
  NG: [8, 9.1, 5],
  SN: [-14.5, 14.4, 6],
  CI: [-5.5, 7.5, 6],
};

type ReferencePoint = {
  latitude: number;
  longitude: number;
  label: string;
};

type Props = {
  token?: string;
  countryCode: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
  referencePoint?: ReferencePoint | null;
  fixedHeight?: boolean;
};

export function CountryMapPreview({
  token,
  countryCode,
  expanded = false,
  onToggleExpand,
  referencePoint = null,
  fixedHeight = false,
}: Props) {
  const { t } = usePreferences();

  const container = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapboxMap | null>(null);

  const [style, setStyle] = React.useState<"streets" | "satellite">(
    "streets",
  );
  const [failed, setFailed] = React.useState(false);

  /*
   * Crée la carte et la recrée si le pays ou le fond de carte change.
   */
  React.useEffect(() => {
    if (!token || !container.current) return;

    let cancelled = false;
    let createdMap: MapboxMap | null = null;

    setFailed(false);

    async function initializeMap() {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;

        if (cancelled || !container.current) return;

        mapboxgl.accessToken = token!;

        const [longitude, latitude, zoom] =
          CENTERS[countryCode] ?? ([-2.5, 54.2, 5] as [number, number, number]);

        const map = new mapboxgl.Map({
          container: container.current,
          style:
            style === "streets"
              ? "mapbox://styles/mapbox/streets-v12"
              : "mapbox://styles/mapbox/satellite-streets-v12",
          center: [longitude, latitude],
          zoom,
          attributionControl: true,
        });

        createdMap = map;
        mapRef.current = map;

        map.addControl(
          new mapboxgl.NavigationControl({
            showCompass: false,
          }),
          "top-right",
        );

        map.addControl(
          new mapboxgl.ScaleControl({
            unit: "metric",
          }),
          "bottom-right",
        );

        map.on("error", () => {
          if (!cancelled) setFailed(true);
        });

        map.once("load", () => {
          if (cancelled) return;

          window.setTimeout(() => {
            if (!cancelled) map.resize();
          }, 100);
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void initializeMap();

    return () => {
      cancelled = true;

      if (createdMap) {
        createdMap.remove();
      }

      if (mapRef.current === createdMap) {
        mapRef.current = null;
      }
    };
  }, [token, countryCode, style]);

  /*
   * Mapbox doit recalculer sa taille lorsque le conteneur
   * passe en plein écran ou revient à sa taille normale.
   */
  React.useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    const timer = window.setTimeout(() => {
      map.resize();
    }, 180);

    return () => window.clearTimeout(timer);
  }, [expanded, fixedHeight]);

  /*
   * Centre la carte sur le point recherché sans démonter
   * la carte lorsqu'une nouvelle recherche est effectuée.
   */
  React.useEffect(() => {
    const map = mapRef.current;

    if (!map || !referencePoint) return;

    map.easeTo({
      center: [
        referencePoint.longitude,
        referencePoint.latitude,
      ],
      zoom: 11,
      duration: 650,
    });
  }, [referencePoint?.latitude, referencePoint?.longitude]);

  const containerHeightClass =
    fixedHeight || expanded
      ? "min-h-0 flex-1"
      : "h-[320px] sm:h-[390px]";

  const mapContainerClass = [
    "w-full",
    "transition-[height] duration-300",
    containerHeightClass,
  ].join(" ");

  const frameClass = [
    "overflow-hidden rounded-2xl border border-line bg-surface shadow-sm",
    fixedHeight || expanded ? "flex h-full min-h-0 flex-col" : "",
  ].join(" ");

  const toggleButton = onToggleExpand ? (
    <button
      type="button"
      onClick={onToggleExpand}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-ink"
      aria-label={
        expanded
          ? t("Réduire la carte", "Collapse map")
          : t("Agrandir la carte", "Expand map")
      }
      title={
        expanded
          ? t("Réduire la carte", "Collapse map")
          : t("Agrandir la carte", "Expand map")
      }
    >
      {expanded ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </button>
  ) : null;

  /*
   * Affichage de secours si le jeton Mapbox est absent
   * ou si la carte ne peut pas être initialisée.
   */
  if (!token || failed) {
    return (
      <div className={frameClass}>
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {t("Carte de référence", "Reference map")}
            </p>

            <p className="mt-1 text-xs text-muted">
              {t(
                "La carte détaillée n'est pas disponible.",
                "The detailed map is unavailable.",
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <MapPinned className="h-5 w-5 shrink-0 text-primary" />
            {toggleButton}
          </div>
        </div>

        <MapNotice
          className={
            fixedHeight || expanded
              ? "min-h-0 flex-1 rounded-none border-0"
              : "h-[390px] rounded-none border-0"
          }
        />
      </div>
    );
  }

  return (
    <div className={frameClass}>
      {/* Barre d'outils de la carte */}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            {t("Carte de référence", "Reference map")}
          </p>

          <p className="mt-1 text-xs text-muted">
            {referencePoint
              ? referencePoint.label
              : t(
                  "Vue du pays sélectionné",
                  "Selected country view",
                )}
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-line bg-bg p-1">
          {toggleButton}

          <button
            type="button"
            onClick={() => setStyle("streets")}
            aria-pressed={style === "streets"}
            className={[
              "inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:px-3",
              style === "streets"
                ? "bg-surface text-primary shadow-sm"
                : "text-muted hover:text-ink",
            ].join(" ")}
          >
            <Layers2 className="h-3.5 w-3.5" />
            {t("Rues", "Streets")}
          </button>

          <button
            type="button"
            onClick={() => setStyle("satellite")}
            aria-pressed={style === "satellite"}
            className={[
              "inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:px-3",
              style === "satellite"
                ? "bg-surface text-primary shadow-sm"
                : "text-muted hover:text-ink",
            ].join(" ")}
          >
            <Satellite className="h-3.5 w-3.5" />
            {t("Satellite", "Satellite")}
          </button>
        </div>
      </div>

      {/* La carte occupe tout l'espace restant */}

      <div
        ref={container}
        className={mapContainerClass}
        role="application"
        aria-label={t(
          "Carte du pays sélectionné",
          "Selected country map",
        )}
      />
    </div>
  );
}