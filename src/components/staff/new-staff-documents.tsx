"use client";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/form";
import { usePreferences } from "@/components/providers/preferences-provider";
import { docName, type DocType } from "@/lib/documents";

export type DocEntry = { date: string; none: boolean };
export type DocEntries = Record<string, DocEntry>;

/** Une entrée est « renseignée » dès qu'il y a une date (ou « sans expiration » / « fourni »). Aucun fichier n'est nécessaire. */
export const isFilled = (e: DocEntry | undefined) => Boolean(e && (e.none || e.date));

/** Documents saisis directement à la création d'un staff : tout est facultatif, la date seule suffit. */
export function NewStaffDocuments({ types, value, onChange }: { types: DocType[]; value: DocEntries; onChange: (v: DocEntries) => void }) {
  const { t, locale } = usePreferences();
  const list = types.filter((x) => !x.archived_at);
  const set = (id: string, patch: Partial<DocEntry>) => onChange({ ...value, [id]: { date: "", none: false, ...value[id], ...patch } });
  const missing = list.filter((x) => x.mandatory && !isFilled(value[x.id])).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {t("Facultatif à ce stade. Une date de validité suffit pour que le staff soit apte : le fichier ou le lien peut être ajouté plus tard.", "Optional at this stage. A validity date is enough for the staff member to be eligible: the file or link can be added later.")}
      </p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {list.map((x) => {
          const e = value[x.id] ?? { date: "", none: false };
          return (
            <li key={x.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{docName(x, locale)}</span>
                {x.mandatory ? <Badge tone="amber">{t("Obligatoire", "Mandatory")}</Badge> : <Badge>{t("Facultatif", "Optional")}</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {x.can_expire ? (
                  <>
                    <label className="sr-only" htmlFor={`doc-${x.id}`}>{t("Date d’expiration", "Expiry date")}</label>
                    <Input id={`doc-${x.id}`} type="date" value={e.date} disabled={e.none} onChange={(ev) => set(x.id, { date: ev.target.value, none: false })} className="w-44" />
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input type="checkbox" checked={e.none} onChange={(ev) => set(x.id, { none: ev.target.checked, date: "" })} />
                      {t("Sans expiration", "No expiry")}
                    </label>
                  </>
                ) : (
                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={e.none} onChange={(ev) => set(x.id, { none: ev.target.checked, date: "" })} />
                    {t("Fourni", "Provided")}
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {missing > 0
        ? <p className="text-xs text-muted">{t(`${missing} document(s) obligatoire(s) non renseigné(s) : le staff ne pourra pas être assigné à une mission tant qu’ils manquent.`, `${missing} mandatory document(s) not filled in: the staff member can’t be assigned to a mission until they are.`)}</p>
        : <p className="text-xs text-success">{t("Tous les documents obligatoires sont renseignés : le staff sera apte à travailler.", "All mandatory documents are filled in: the staff member will be eligible to work.")}</p>}
    </div>
  );
}
