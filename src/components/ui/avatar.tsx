import { cn, initials } from "@/lib/utils";

const PALETTE = ["#0878c0", "#0c7c59", "#7c3aed", "#b45309", "#be185d", "#0e7490", "#4d7c0f", "#b3151b"];
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Photo du staff si elle existe ; sinon initiales sur fond coloré stable. */
export function Avatar({ name, photoUrl, size = 36, className }: { name: string; photoUrl?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) };
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" width={size} height={size} loading="lazy" decoding="async" className={cn("shrink-0 rounded-full object-cover ring-1 ring-line", className)} style={style} />;
  }
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full font-semibold text-white", className)} style={{ ...style, background: PALETTE[hash(name) % PALETTE.length] }}>
      {initials(name)}
    </span>
  );
}
