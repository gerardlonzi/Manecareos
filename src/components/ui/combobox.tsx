"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Flag } from "./flag";

export type ComboOption = { value: string; label: string; description?: string; flag?: string; group?: string; keywords?: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase();

function usePopover(open: boolean, close: () => void, anchor: React.RefObject<HTMLElement | null>, panel: React.RefObject<HTMLElement | null>) {
  const [rect, setRect] = React.useState<{ top: number; left: number; width: number; up: boolean; max: number } | null>(null);
  React.useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const place = () => {
      const r = anchor.current!.getBoundingClientRect();
      const below = window.innerHeight - r.bottom, above = r.top;
      const up = below < 300 && above > below;
      setRect({ top: up ? r.top - 6 : r.bottom + 6, left: r.left, width: Math.max(r.width, 220), up, max: Math.max(180, Math.min(340, (up ? above : below) - 70)) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, anchor]);
  React.useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { const n = e.target as Node; if (!anchor.current?.contains(n) && !panel.current?.contains(n)) close(); };
    const scroll = (e: Event) => { if (!panel.current?.contains(e.target as Node)) close(); };
    document.addEventListener("pointerdown", down);
    window.addEventListener("scroll", scroll, true);
    return () => { document.removeEventListener("pointerdown", down); window.removeEventListener("scroll", scroll, true); };
  }, [open, close, anchor, panel]);
  return rect;
}

function Panel({ rect, panelRef, anchor, children }: { rect: NonNullable<ReturnType<typeof usePopover>>; panelRef: React.RefObject<HTMLDivElement | null>; anchor: React.RefObject<HTMLElement | null>; children: React.ReactNode }) {
  const host = (anchor.current?.closest("dialog") as HTMLElement | null) ?? document.body;
  return createPortal(
    <div ref={panelRef} style={{ position: "fixed", left: rect.left, width: rect.width, top: rect.up ? undefined : rect.top, bottom: rect.up ? window.innerHeight - rect.top : undefined, zIndex: 200 }}
      className="anim-pop overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)]">{children}</div>, host);
}

function List({ id, options, isSelected, onPick, query, setQuery, max, placeholder, multi }: { id: string; options: ComboOption[]; isSelected: (v: string) => boolean; onPick: (o: ComboOption) => void; query: string; setQuery: (q: string) => void; max: number; placeholder: string; multi?: boolean }) {
  const { t } = usePreferences();
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const filtered = React.useMemo(() => {
    const q = norm(query.trim());
    const res = q ? options.filter((o) => norm(`${o.label} ${o.description ?? ""} ${o.keywords ?? ""} ${o.value}`).includes(q)) : options;
    return res.slice(0, 120);
  }, [options, query]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setActive(0), [query]);
  React.useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[active]) onPick(filtered[active]); }
  };
  let lastGroup: string | undefined;
  return (
    <>
      <div className="border-b border-line p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} placeholder={placeholder} aria-label={placeholder} role="combobox" aria-expanded aria-controls={`${id}-list`} autoComplete="off"
            className="h-9 w-full rounded-lg border border-line bg-bg pl-8 pr-3 text-sm placeholder:text-muted/70 focus:border-primary" />
        </div>
      </div>
      <div id={`${id}-list`} ref={listRef} role="listbox" aria-multiselectable={multi} style={{ maxHeight: max }} className="scroll-thin overflow-y-auto p-1">
        {filtered.length === 0 ? <p className="px-3 py-6 text-center text-xs text-muted">{t("Aucun résultat. Essayez un autre terme.", "No results. Try another term.")}</p> : filtered.map((o, i) => {
          const head = o.group && o.group !== lastGroup ? o.group : null; lastGroup = o.group;
          const sel = isSelected(o.value);
          return (
            <React.Fragment key={o.value}>
              {head ? <p className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">{head}</p> : null}
              <button type="button" role="option" aria-selected={sel} data-i={i} onMouseEnter={() => setActive(i)} onClick={() => onPick(o)}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm", i === active ? "bg-primary-soft" : "", sel && "font-semibold text-primary")}>
                {o.flag ? <Flag flag={o.flag} /> : null}
                <span className="min-w-0 flex-1"><span className="block truncate">{o.label}</span>{o.description ? <span className="block truncate text-xs font-normal text-muted">{o.description}</span> : null}</span>
                {sel ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
}

type SingleProps = { id: string; value: string; onChange: (v: string) => void; options: ComboOption[]; placeholder?: string; searchPlaceholder?: string; disabled?: boolean; name?: string; className?: string; clearable?: boolean; required?: boolean; size?: "sm" | "md"; "aria-invalid"?: boolean };

/** Liste déroulante avec recherche — remplace tout <select> natif. */
export function Combobox({ id, value, onChange, options, placeholder, searchPlaceholder, disabled, name, className, clearable, required, size = "md", ...rest }: SingleProps) {
  const { t } = usePreferences();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const anchor = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => { setOpen(false); setQuery(""); }, []);
  const rect = usePopover(open, close, anchor, panel);
  const sel = options.find((o) => o.value === value);
  return (
    <div className={cn("relative min-w-0", className)}>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <button ref={anchor} id={id} type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-invalid={rest["aria-invalid"]} onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Escape") close(); }}
        className={cn("flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger", size === "sm" ? "h-9" : "h-10")}>
        {sel?.flag ? <Flag flag={sel.flag} /> : null}
        <span className={cn("min-w-0 flex-1 truncate", !sel && "text-muted/80")}>{sel?.label ?? placeholder ?? t("Sélectionner…", "Select…")}</span>
        {clearable && sel ? <span role="button" tabIndex={-1} aria-label={t("Effacer", "Clear")} onClick={(e) => { e.stopPropagation(); onChange(""); }} className="grid h-5 w-5 place-items-center rounded text-muted hover:bg-primary-soft"><X className="h-3 w-3" /></span> : null}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && rect ? <Panel rect={rect} panelRef={panel} anchor={anchor}>
        <List id={id} options={options} isSelected={(v) => v === value} query={query} setQuery={setQuery} max={rect.max} placeholder={searchPlaceholder ?? t("Rechercher…", "Search…")}
          onPick={(o) => { onChange(o.value); close(); anchor.current?.focus(); }} />
      </Panel> : null}
    </div>
  );
}

type MultiProps = { id: string; values: string[]; onChange: (v: string[]) => void; options: ComboOption[]; placeholder?: string; searchPlaceholder?: string; className?: string; renderLabel?: (v: string) => string; max?: number };

/** Sélection multiple avec recherche, pastilles compactes. */
export function MultiCombobox({ id, values, onChange, options, placeholder, searchPlaceholder, className, renderLabel }: MultiProps) {
  const { t } = usePreferences();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const anchor = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => { setOpen(false); setQuery(""); }, []);
  const rect = usePopover(open, close, anchor, panel);
  const label = (v: string) => renderLabel?.(v) ?? options.find((o) => o.value === v)?.label ?? v;
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <div className={cn("min-w-0", className)}>
      <button ref={anchor} id={id} type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/10">
        <span className={cn("min-w-0 flex-1 truncate", !values.length && "text-muted/80")}>{values.length ? t(`${values.length} sélectionné(s)`, `${values.length} selected`) : placeholder ?? t("Sélectionner…", "Select…")}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {values.length ? <ul className="mt-2 flex flex-wrap gap-1.5">{values.map((v) => (
        <li key={v} className="inline-flex items-center gap-1 rounded-md bg-primary-soft py-1 pl-2 pr-1 text-xs font-medium text-primary">
          {label(v)}
          <button type="button" onClick={() => toggle(v)} aria-label={t(`Retirer ${label(v)}`, `Remove ${label(v)}`)} className="grid h-4 w-4 place-items-center rounded hover:bg-primary/15"><X className="h-3 w-3" /></button>
        </li>))}</ul> : null}
      {open && rect ? <Panel rect={rect} panelRef={panel} anchor={anchor}>
        <List id={id} multi options={options} isSelected={(v) => values.includes(v)} query={query} setQuery={setQuery} max={rect.max} placeholder={searchPlaceholder ?? t("Rechercher…", "Search…")} onPick={(o) => toggle(o.value)} />
      </Panel> : null}
    </div>
  );
}
