"use client";
import * as React from "react";

/** Avertit avant de quitter un formulaire modifié : fermeture d'onglet et clic sur un lien interne. */
export function useUnsavedWarning(dirty: boolean, message = "Des modifications non enregistrées seront perdues. Quitter cette page ?") {
  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== window.location.origin || a.getAttribute("href")?.startsWith("#")) return;
      if (a.href === window.location.href) return;
      if (!window.confirm(message)) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => { window.removeEventListener("beforeunload", onBeforeUnload); document.removeEventListener("click", onClick, true); };
  }, [dirty, message]);
}
