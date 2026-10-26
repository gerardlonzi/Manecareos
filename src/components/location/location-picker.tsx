"use client";
import * as React from "react";
import { LoaderCircle, MapPin, Search, X } from "lucide-react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Field, Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type Ctx = { id: string; text: string; short_code?: string };
type Feature = { id: string; place_name: string; text: string; place_type?: string[]; center: [number, number]; context?: Ctx[] };
type Props = {
  countryCode: string;
  /** Nation du Royaume-Uni choisie (England, Scotland, Wales, Northern Ireland) : restreint les résultats. */
  nation?: string | null;
  postal: string; city: string; region: string;
  setPostal: (v: string) => void; setCity: (v: string) => void; setRegion: (v: string) => void;
  error?: string;
};

const ctxText = (f: Feature, prefix: string) => f.context?.find((c) => c.id.startsWith(prefix))?.text ?? "";

/** Choix d’un lieu : la ville remplit aussi le code postal (géocodage inverse du centre-ville) ; le code postal reste modifiable. */
export function LocationPicker({ countryCode, nation, postal, city, region, setPostal, setCity, setRegion, error }: Props) {
  const { locale, t } = usePreferences();
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const [query, setQuery] = React.useState([city, postal].filter(Boolean).join(", "));
  const [results, setResults] = React.useState<Feature[]>([]);
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [lookingUp, setLookingUp] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [derived, setDerived] = React.useState(false);
  const skipSync = React.useRef(false);

  // Resynchronise le champ quand la valeur change de l’extérieur (chargement d’une fiche, effacement…).
  React.useEffect(() => {
    if (skipSync.current) { skipSync.current = false; return; }
    setQuery([city, postal].filter(Boolean).join(", "));
  }, [city, postal]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open || query.trim().length < 2) { setResults([]); setPending(false); return; }
    if (!token) { setResults([]); setMessage(t("La recherche de lieux nécessite une clé Mapbox.", "Place search requires a Mapbox token.")); return; }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      setPending(true); setMessage("");
      try {
        const call = async (types: string) => {
          const p = new URLSearchParams({ access_token: token, autocomplete: "true", limit: "8", language: locale, types, country: countryCode.toLowerCase() });
          const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json?${p}`, { signal: ctl.signal });
          if (!r.ok) throw new Error("search");
          return ((await r.json()) as { features?: Feature[] }).features ?? [];
        };
        const [places, codes] = await Promise.all([call("place,locality,district"), call("postcode")]);
        const seen = new Set<string>();
        const nationOk = (f: Feature) => !nation || ctxText(f, "region").toLowerCase() === nation.toLowerCase() || f.place_name.toLowerCase().includes(nation.toLowerCase());
        const merged = [...places, ...codes].filter((f) => { if (seen.has(f.id)) return false; seen.add(f.id); return nationOk(f); });
        const postalFirst = /\d/.test(query);
        merged.sort((a, b) => (postalFirst ? 1 : -1) * ((a.place_type?.includes("postcode") ? 1 : 0) - (b.place_type?.includes("postcode") ? 1 : 0)));
        setResults(merged.slice(0, 10));
        if (!merged.length) setMessage(t("Aucun lieu trouvé. Essayez une ville ou un code postal plus précis.", "No place found. Try a more specific city or postcode."));
      } catch { if (!ctl.signal.aborted) { setResults([]); setMessage(t("Recherche impossible pour le moment.", "Search is unavailable right now.")); } }
      finally { if (!ctl.signal.aborted) setPending(false); }
    }, 250);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [query, open, countryCode, nation, locale, token, t]);

  const choose = async (f: Feature) => {
    const isPostcode = f.place_type?.includes("postcode");
    const cityName = isPostcode ? (ctxText(f, "place") || ctxText(f, "locality") || ctxText(f, "district")) : f.text;
    const regionName = ctxText(f, "region") || nation || "";
    const code = isPostcode ? f.text : ctxText(f, "postcode");
    skipSync.current = true;
    setCity(cityName); setRegion(regionName); setPostal(code); setDerived(false);
    setQuery([cityName, code].filter(Boolean).join(", "));
    setOpen(false); setResults([]); setMessage("");
    // Une ville n’a pas de code postal propre : on cherche celui du centre-ville.
    if (!code && token) {
      setLookingUp(true);
      try {
        const p = new URLSearchParams({ access_token: token, types: "postcode", limit: "1", language: locale });
        const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${f.center[0]},${f.center[1]}.json?${p}`);
        const found = r.ok ? ((await r.json()) as { features?: Feature[] }).features?.[0] : undefined;
        if (found?.text) { skipSync.current = true; setPostal(found.text); setDerived(true); setQuery([cityName, found.text].filter(Boolean).join(", ")); }
      } catch { /* le code postal reste modifiable à la main */ }
      finally { setLookingUp(false); }
    }
  };

  const clear = () => { setQuery(""); setPostal(""); setCity(""); setRegion(nation ?? ""); setDerived(false); setOpen(false); };

  return (
    <div className="space-y-3">
      <Field id="location-search" label={t("Ville ou code postal", "City or postcode")} error={error}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input id="location-search" value={query} autoComplete="off" role="combobox" aria-expanded={open} aria-controls="location-suggestions" className="pl-9 pr-9"
            placeholder={t("Ex. : Birmingham, Édimbourg, B1 1AA…", "E.g. Birmingham, Edinburgh, B1 1AA…")}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
          {query ? <button type="button" onClick={clear} aria-label={t("Effacer", "Clear")} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-primary-soft"><X className="h-4 w-4" aria-hidden /></button> : null}
          {open && (pending || results.length > 0 || message) ? (
            <div id="location-suggestions" role="listbox" className="anim-pop absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)]">
              {pending ? <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />{t("Recherche…", "Searching…")}</div> : null}
              {!pending ? results.map((f) => (
                <button type="button" role="option" aria-selected={false} key={f.id} onClick={() => void choose(f)} className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-primary-soft">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{f.place_type?.includes("postcode") ? `${t("Code postal", "Postcode")} ${f.text}` : f.text}</span><span className="block truncate text-xs text-muted">{f.place_name}</span></span>
                </button>
              )) : null}
              {!pending && message ? <p className="px-3 py-3 text-xs text-muted">{message}</p> : null}
            </div>
          ) : null}
        </div>
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <div><span className="mb-1.5 block text-[13px] font-medium">{t("Ville", "City")}</span><p className={cn("flex h-10 items-center rounded-lg border border-line bg-surface-2 px-3 text-sm", !city && "text-muted")}>{city || "—"}</p></div>
        <div><span className="mb-1.5 block text-[13px] font-medium">{t("Région / nation", "Region / nation")}</span><p className={cn("flex h-10 items-center rounded-lg border border-line bg-surface-2 px-3 text-sm", !region && "text-muted")}>{region || "—"}</p></div>
        <Field id="postal-field" label={t("Code postal", "Postcode")} hint={derived ? t("Code postal du centre-ville (indicatif) — modifiable.", "City-centre postcode (approximate) — editable.") : undefined}>
          <div className="relative">
            <Input id="postal-field" value={postal} onChange={(e) => { setPostal(e.target.value.toUpperCase()); setDerived(false); }} autoComplete="off" placeholder={lookingUp ? t("Recherche…", "Looking up…") : "B1 1AA"} />
            {lookingUp ? <LoaderCircle className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" aria-hidden /> : null}
          </div>
        </Field>
      </div>
    </div>
  );
}
