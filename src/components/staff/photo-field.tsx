"use client";
import * as React from "react";
import { Camera, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/components/providers/preferences-provider";

/** Réduit la photo dans le navigateur (512 px, JPEG) avant l’envoi : rapide et sous la limite de 2 Mo. */
export async function resizePhoto(file: File, max = 512): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
  if (!blob) throw new Error("resize");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

export type PhotoChange = { file: File | null; remove: boolean };

/** Photo facultative : sans photo, les initiales sont affichées partout. */
export function PhotoField({ name, currentUrl, onChange }: { name: string; currentUrl?: string | null; onChange: (c: PhotoChange) => void }) {
  const { t } = usePreferences();
  const input = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [removed, setRemoved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const shown = removed ? null : preview ?? currentUrl ?? null;
  return (
    <div className="flex items-center gap-4">
      <Avatar name={name || "?"} photoUrl={shown} size={72} />
      <div>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={t("Choisir une photo", "Choose a photo")}
            onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return; setError(null);
              try { const small = await resizePhoto(f); setPreview(URL.createObjectURL(small)); setRemoved(false); onChange({ file: small, remove: false }); }
              catch { setError(t("Impossible de lire cette image.", "This image could not be read.")); }
              e.target.value = "";
            }} />
          <Button size="sm" variant="secondary" onClick={() => input.current?.click()}><Camera className="h-4 w-4" aria-hidden />{shown ? t("Changer la photo", "Change photo") : t("Ajouter une photo", "Add a photo")}</Button>
          {shown ? <Button size="sm" variant="ghost" onClick={() => { setPreview(null); setRemoved(true); onChange({ file: null, remove: true }); }}><Trash2 className="h-4 w-4" aria-hidden />{t("Retirer", "Remove")}</Button> : null}
        </div>
        <p className="mt-1.5 text-xs text-muted">{t("Facultatif · JPEG, PNG ou WebP. Sans photo, les initiales sont utilisées.", "Optional · JPEG, PNG or WebP. Without a photo, initials are used.")}</p>
        {error ? <p role="alert" className="mt-1 text-xs text-danger">{error}</p> : null}
      </div>
    </div>
  );
}
