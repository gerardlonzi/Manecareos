"use client";
import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Flag } from "./flag";
import { cn } from "@/lib/utils";

export type PickerOption = { value: string; label: string; description?: string; /** classe flag-icons, ex. « gb-sct » */ flag?: string; /** texte supplémentaire pour la recherche (autre langue, indicatif…) */ search?: string; /** petite pastille colorée devant le libellé (ex. disponibilité) */ dot?: "green" | "red" | "amber" };

const DOT = { green: "bg-success", red: "bg-danger", amber: "bg-[#f59e0b]" } as const;
const Dot = ({ color }: { color: keyof typeof DOT }) => <span aria-hidden className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT[color])} />;
type Props = { id: string; value: string; options: PickerOption[]; onValueChange: (value: string) => void; placeholder?: string; searchPlaceholder?: string; disabled?: boolean; name?: string; className?: string; required?: boolean; clearable?: boolean; invalid?: boolean; /** Zone de recherche : auto = visible si plus de 7 options */ searchable?: boolean | "auto"; size?: "sm" | "md" };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase();

/** Liste déroulante avec recherche intégrée (remplace tout <select> natif). Navigation clavier : ↑ ↓ Entrée Échap. */
export function SearchablePicker({ id, value, options, onValueChange, placeholder, searchPlaceholder, disabled, name, className, required, clearable, invalid, size = "md", searchable = "auto" }: Props) {
  const showSearch = searchable === "auto" ? options.length > 7 : searchable;
  const { t } = usePreferences();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const root = React.useRef<HTMLDivElement>(null);
  const list = React.useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  const filtered = React.useMemo(() => {
    const q = norm(query.trim());
    const base = q ? options.filter((o) => norm(`${o.label} ${o.description ?? ""} ${o.search ?? ""} ${o.value}`).includes(q)) : options;
    return base.slice(0, 120);
  }, [options, query]);

  React.useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) { setOpen(false); setQuery(""); } };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => { setActive(0); }, [query, open]);
  React.useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  const choose = (o: PickerOption) => { onValueChange(o.value); setOpen(false); setQuery(""); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); const o = filtered[active]; if (o) choose(o); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };
  return (
    <div ref={root} className={cn("relative min-w-0", className)}>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <button id={id} type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-invalid={invalid || undefined}
        onClick={() => { setOpen((v) => !v); setQuery(""); }}
        className={cn("flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm text-ink hover:border-primary/40 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger", size === "sm" ? "h-9" : "h-10")}>
        <span className="flex min-w-0 items-center gap-2">
          {selected?.flag ? <Flag flag={selected.flag} /> : null}
          {selected?.dot ? <Dot color={selected.dot} /> : null}
          <span className={cn("truncate", !selected && "text-muted")}>{selected?.label ?? placeholder ?? t("Sélectionner…", "Select…")}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="anim-pop absolute left-0 z-50 mt-1 min-w-full max-w-[90vw] overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)]" style={{ width: "max(100%, 16rem)" }}>
          {showSearch ? <div className="border-b border-line p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} placeholder={searchPlaceholder ?? t("Rechercher…", "Search…")} aria-label={searchPlaceholder ?? t("Rechercher dans la liste", "Search the list")} role="combobox" aria-expanded aria-controls={`${id}-options`}
                className="h-9 w-full rounded-lg border border-line bg-bg pl-9 pr-3 text-sm placeholder:text-muted focus:border-primary" />
            </div>
          </div> : <input autoFocus readOnly onKeyDown={onKey} aria-label={t("Choisir", "Choose")} className="sr-only" />}
          <div ref={list} id={`${id}-options`} role="listbox" className="scroll-thin max-h-64 overflow-y-auto p-1">
            {clearable && value ? <button type="button" onClick={() => { onValueChange(""); setOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-primary-soft">{t("Effacer la sélection", "Clear selection")}</button> : null}
            {filtered.length ? filtered.map((o, i) => (
              <button type="button" role="option" aria-selected={o.value === value} data-i={i} key={o.value} onClick={() => choose(o)} onMouseEnter={() => setActive(i)}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm", i === active && "bg-primary-soft", o.value === value && "font-semibold text-primary")}>
                {o.flag ? <Flag flag={o.flag} /> : null}
                {o.dot ? <Dot color={o.dot} /> : null}
                <span className="min-w-0 flex-1"><span className="block truncate">{o.label}</span>{o.description ? <span className="block truncate text-xs font-normal text-muted">{o.description}</span> : null}</span>
                {o.value === value ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
              </button>
            )) : <p className="px-3 py-5 text-center text-xs text-muted">{t("Aucun résultat. Essayez un autre terme.", "No results. Try another term.")}</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
export { SearchablePicker as Combobox };
