"use client";
import * as React from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapNotice } from "./map-notice";

/** Carte à un seul point : la localisation ENREGISTRÉE (pas une position en direct). */
export default function LocationMap({ latitude, longitude, label, token, className = "h-64" }: { latitude: number; longitude: number; label: string; token?: string; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!token || !ref.current) return;
    let map: import("mapbox-gl").Map | undefined;
    let cancelled = false;
    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (cancelled || !ref.current) return;
        mapboxgl.accessToken = token;
        map = new mapboxgl.Map({ container: ref.current, style: "mapbox://styles/mapbox/streets-v12", center: [longitude, latitude], zoom: 12 });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        new mapboxgl.Marker({ color: "#1d3b5c" }).setLngLat([longitude, latitude]).setPopup(new mapboxgl.Popup({ offset: 24 }).setText(label)).addTo(map);
        map.on("error", () => setFailed(true));
      } catch {
        setFailed(true);
      }
    })();
    return () => { cancelled = true; map?.remove(); };
  }, [latitude, longitude, label, token]);

  if (!token || failed) return <MapNotice className={className} />;
  return (
    <div className="relative">
      <div ref={ref} className={`w-full overflow-hidden rounded-xl border border-line ${className}`} role="img" aria-label={`Carte : ${label}`} />
      <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-surface/90 px-2 py-1 text-xs text-muted shadow-card">Localisation enregistrée — pas une position en direct</p>
    </div>
  );
}
