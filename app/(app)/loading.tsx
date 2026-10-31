import { Skeleton } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading / Chargement">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
