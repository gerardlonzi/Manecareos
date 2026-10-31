"use client";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/providers/preferences-provider";
import { toQuery } from "@/lib/utils";

export function Pagination({ page, pageSize, total, basePath, params = {} }: { page: number; pageSize: number; total: number; basePath: string; params?: Record<string, string | number | null | undefined> }) {
  // Les liens sont construits ici (côté client) : une fonction ne peut pas être passée depuis une page serveur.
  const hrefFor = (p: number) => `${basePath}${toQuery({ ...params, page: p <= 1 ? "" : p })}`;
  const { t } = usePreferences();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = "inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:border-primary/40 hover:bg-primary-soft/50";
  const off = "pointer-events-none opacity-40";
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 px-1 py-4 text-sm text-muted">
      <p>{total === 0 ? t("Aucun résultat", "No results") : `${from}–${to} ${t("sur", "of")} ${total}`}</p>
      <div className="flex items-center gap-2">
        <Link href={hrefFor(page - 1)} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : 0} className={cn(link, page <= 1 && off)}><ChevronLeft className="h-4 w-4" aria-hidden /> {t("Précédent", "Previous")}</Link>
        <span aria-current="page" className="px-1 tabular-nums">{page} / {pages}</span>
        <Link href={hrefFor(page + 1)} aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : 0} className={cn(link, page >= pages && off)}>{t("Suivant", "Next")} <ChevronRight className="h-4 w-4" aria-hidden /></Link>
      </div>
    </nav>
  );
}
