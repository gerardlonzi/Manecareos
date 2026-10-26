"use client";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/providers/preferences-provider";
import type { AvailabilityStatus, LocationStatus, MissionStatus, AssignmentStatus } from "@/lib/types";

type Tone = "green" | "red" | "gray" | "amber" | "blue";
const tones: Record<Tone, string> = {
  green: "bg-success-soft text-success",
  red: "bg-danger-soft text-danger",
  gray: "bg-muted/10 text-muted",
  amber: "bg-warning-soft text-warning",
  blue: "bg-primary-soft text-primary",
};

const L = {
  availability: { available: ["Disponible", "Available"], unavailable: ["Indisponible", "Unavailable"], unknown: ["Inconnue", "Unknown"] },
  location: { resolved: ["Localisation vérifiée", "Location verified"], pending: ["À vérifier", "Needs checking"], failed: ["À revoir", "Needs review"] },
  mission: { draft: ["Brouillon", "Draft"], open: ["Ouverte", "Open"], staffing_in_progress: ["Recrutement en cours", "Staffing in progress"], staffed: ["Pourvue", "Staffed"], completed: ["Terminée", "Completed"], cancelled: ["Annulée", "Cancelled"] },
  assignment: { selected: ["Sélectionné", "Selected"], contacted: ["Contacté", "Contacted"], confirmed: ["Confirmé", "Confirmed"], declined: ["A refusé", "Declined"], cancelled: ["Annulé", "Cancelled"], completed: ["Terminé", "Completed"] },
} as const;

/** Le statut est toujours dit en texte (pas seulement par la couleur) pour rester accessible. */
export function Badge({ tone = "gray", children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium leading-none", tones[tone], className)}>
      {dot ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

function useL<K extends keyof typeof L>(group: K, key: keyof (typeof L)[K]) {
  const { locale } = usePreferences();
  const pair = (L[group] as Record<string, readonly [string, string]>)[key as string];
  return pair ? pair[locale === "fr" ? 0 : 1] : String(key);
}

export function AvailabilityBadge({ status }: { status: AvailabilityStatus }) {
  const label = useL("availability", status);
  return <Badge dot tone={status === "available" ? "green" : status === "unavailable" ? "red" : "gray"}>{label}</Badge>;
}
export function LocationBadge({ status }: { status: LocationStatus }) {
  const label = useL("location", status);
  return <Badge dot tone={status === "resolved" ? "green" : status === "failed" ? "red" : "amber"}>{label}</Badge>;
}
export function MissionStatusBadge({ status }: { status: MissionStatus }) {
  const label = useL("mission", status);
  return <Badge dot tone={status === "staffed" || status === "completed" ? "green" : status === "cancelled" ? "red" : status === "draft" ? "gray" : "blue"}>{label}</Badge>;
}
export function AssignmentBadge({ status }: { status: AssignmentStatus }) {
  const label = useL("assignment", status);
  return <Badge dot tone={status === "confirmed" || status === "completed" ? "green" : status === "declined" || status === "cancelled" ? "red" : status === "contacted" ? "amber" : "blue"}>{label}</Badge>;
}
