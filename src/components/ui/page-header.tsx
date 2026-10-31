"use client";
import * as React from "react";

/** En-tête de page collant (titre + actions + barre d’outils). Publie sa hauteur dans --sticky-h pour les en-têtes de tableau. */
export function PageHeader({ title, description, actions, children, toolbar, back }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; toolbar?: React.ReactNode; back?: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--sticky-h", `${el.getBoundingClientRect().height}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty("--sticky-h"); };
  }, []);
  return (
    <div ref={ref} data-fullbleed className="glass sticky top-[var(--app-header-h)] z-30 mb-5 border-b border-line pb-3 pt-4">
      {back ? <div className="mb-2">{back}</div> : null}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children || toolbar ? <div className="mt-3">{toolbar}{children}</div> : null}
    </div>
  );
}
