import { cn } from "@/lib/utils";
import { flagCodeFor } from "@/config/countries";

/** Drapeau SVG (fonctionne aussi sous Windows, contrairement aux emoji). Pour le Royaume-Uni, la région donne la nation. */
export function Flag({ code, region, flag, className }: { code?: string | null; region?: string | null; flag?: string; className?: string }) {
  const f = flag ?? flagCodeFor(code, region);
  if (!f) return null;
  return <span aria-hidden className={cn("fi inline-block h-[14px] w-[19px] shrink-0 rounded-[3px] bg-cover shadow-[0_0_0_1px_rgb(0_0_0/0.12)]", `fi-${f}`, className)} style={{ lineHeight: 1 }} />;
}
