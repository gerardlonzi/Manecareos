import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = "inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-bg";
  const disabled = "pointer-events-none opacity-50";
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 px-1 pt-4 text-sm text-muted">
      <p>{total === 0 ? "Aucun résultat" : `${from}–${to} sur ${total}`}</p>
      <div className="flex items-center gap-2">
        <Link href={hrefFor(page - 1)} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : 0} className={cn(link, page <= 1 && disabled)}>
          <ChevronLeft className="h-4 w-4" aria-hidden /> Précédent
        </Link>
        <span aria-current="page">Page {page} / {pages}</span>
        <Link href={hrefFor(page + 1)} aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : 0} className={cn(link, page >= pages && disabled)}>
          Suivant <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
