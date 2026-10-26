"use client";
import * as React from "react";
/** Intercepte la navigation interne pour afficher une boîte de dialogue intégrée plutôt qu'une alerte native. */
export function useUnsavedWarning(dirty: boolean, message = "Des modifications non enregistrées seront perdues. Quitter cette page ?") {
  React.useEffect(() => {
    if (!dirty) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== window.location.origin || a.getAttribute("href")?.startsWith("#") || a.href === window.location.href) return;
      e.preventDefault(); e.stopPropagation();
      window.dispatchEvent(new CustomEvent("app:unsaved-navigation", { detail: { href: a.href, message } }));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty, message]);
}
