import Link from "next/link";
import { MapPinned } from "lucide-react";
import { APP_CONFIG } from "@/config/app";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white" aria-hidden><MapPinned className="h-4.5 w-4.5" /></span>
      <span className="text-lg">{APP_CONFIG.name}</span>
    </Link>
  );
}
