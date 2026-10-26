import { Skeleton } from "@/components/ui/card";
export default function Loading() {
  return (
    <div className="pt-4" aria-busy="true">
      <Skeleton className="mb-2 h-8 w-56" /><Skeleton className="mb-5 h-10 w-full" />
      <div className="card-surface space-y-3 p-4">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
    </div>
  );
}
