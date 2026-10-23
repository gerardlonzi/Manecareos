import { MapPinOff } from "lucide-react";

export function MapNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`grid place-items-center rounded-xl border border-dashed border-line bg-bg p-6 text-center ${className}`}>
      <div className="max-w-sm">
        <MapPinOff className="mx-auto mb-2 h-6 w-6 text-muted" aria-hidden />
        <p className="text-sm font-medium">Carte indisponible</p>
        <p className="mt-1 text-xs text-muted">
          Renseignez <code>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> (jeton public Mapbox) dans <code>.env.local</code> pour afficher la carte. La liste, les distances et les estimations restent disponibles.
        </p>
      </div>
    </div>
  );
}
