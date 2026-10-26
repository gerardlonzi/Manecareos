import Image from "next/image";
import Link from "next/link";
import { APP_CONFIG } from "@/config/app";

/** Marque Manecare : logo Maneliza Care + nom de la plateforme. */
export function Brand({ href = "/", compact = false, inverse = false, size = 36 }: { href?: string; compact?: boolean; inverse?: boolean; size?: number }) {
  return (
    <Link href={href} className="inline-flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-offset-4" aria-label={`${APP_CONFIG.name} — ${APP_CONFIG.company}`}>
      <Image src="/brand/maneliza-mark.png" alt="" width={size} height={size} priority className="shrink-0 rounded-full" style={{ width: size, height: size }} />
      {compact ? null : (
        <span className="min-w-0 leading-tight">
          <span className={`block truncate text-[17px] font-bold tracking-tight ${inverse ? "text-white" : "text-ink"}`}>{APP_CONFIG.name}</span>
          <span className={`block truncate text-[10px] font-semibold uppercase tracking-[.14em] ${inverse ? "text-white/60" : "text-muted"}`}>{APP_CONFIG.company}</span>
        </span>
      )}
    </Link>
  );
}
