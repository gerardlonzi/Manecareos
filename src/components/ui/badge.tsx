import { cn } from "@/lib/utils";
import type { AvailabilityStatus, LocationStatus, MissionStatus, AssignmentStatus } from "@/lib/types";
import { ASSIGNMENT_STATUS_LABELS, AVAILABILITY_LABELS, LOCATION_STATUS_LABELS, MISSION_STATUS_LABELS } from "@/config/app";

type Tone = "green" | "red" | "gray" | "amber" | "blue";
const tones: Record<Tone, string> = {
  green: "bg-success-soft text-success ring-green-200",
  red: "bg-danger-soft text-danger ring-red-200",
  gray: "bg-gray-100 text-gray-700 ring-gray-200",
  amber: "bg-warning-soft text-warning ring-amber-200",
  blue: "bg-primary-soft text-primary ring-blue-200",
};

/** Le statut est toujours dit en texte (pas seulement par la couleur) pour rester accessible. */
export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone], className)}>{children}</span>;
}

export function AvailabilityBadge({ status }: { status: AvailabilityStatus }) {
  const tone: Tone = status === "available" ? "green" : status === "unavailable" ? "red" : "gray";
  return <Badge tone={tone}>{AVAILABILITY_LABELS[status]}</Badge>;
}

export function LocationBadge({ status }: { status: LocationStatus }) {
  const tone: Tone = status === "resolved" ? "green" : status === "failed" ? "red" : "amber";
  return <Badge tone={tone}>{LOCATION_STATUS_LABELS[status]}</Badge>;
}

export function MissionStatusBadge({ status }: { status: MissionStatus }) {
  const tone: Tone = status === "staffed" || status === "completed" ? "green" : status === "cancelled" ? "red" : status === "draft" ? "gray" : "blue";
  return <Badge tone={tone}>{MISSION_STATUS_LABELS[status]}</Badge>;
}

export function AssignmentBadge({ status }: { status: AssignmentStatus }) {
  const tone: Tone = status === "confirmed" || status === "completed" ? "green" : status === "declined" || status === "cancelled" ? "red" : status === "contacted" ? "amber" : "blue";
  return <Badge tone={tone}>{ASSIGNMENT_STATUS_LABELS[status]}</Badge>;
}
