"use client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/form";
import { SearchInput, useUrlParams } from "@/components/ui/search-input";
import { usePreferences } from "@/components/providers/preferences-provider";
import { EVENT_LABELS, EVENT_LABELS_EN } from "@/config/activity-labels";

/** Filtres appliqués en direct (aucun bouton « Filtrer »). */
export function ActivityFilters({ type, from, to, missionId, staffQ, missions }: { type: string; from: string; to: string; missionId: string; staffQ: string; missions: { id: string; title: string }[] }) {
  const { t, locale } = usePreferences();
  const { set } = useUrlParams();
  const events = Object.entries(EVENT_LABELS).map(([k, fr]) => ({ value: k, label: locale === "fr" ? fr : EVENT_LABELS_EN[k] ?? fr }));
  const has = Boolean(type || from || to || missionId || staffQ);
  return (
    <div role="search" aria-label={t("Filtres d’activité", "Activity filters")} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1.2fr_auto]">
      <SearchInput param="staff" placeholder={t("Nom du staff…", "Staff name…")} />
      <Combobox id="act-type" value={type} onChange={(v) => set({ type: v })} options={events} placeholder={t("Tous les événements", "All events")} clearable />
      <Combobox id="act-mission" value={missionId} onChange={(v) => set({ mission: v })} options={missions.map((m) => ({ value: m.id, label: m.title }))} placeholder={t("Toutes les missions", "All assignments")} clearable />
      <Input type="date" value={from} onChange={(e) => set({ from: e.target.value })} aria-label={t("Date de début", "Start date")} />
      <Input type="date" value={to} onChange={(e) => set({ to: e.target.value })} aria-label={t("Date de fin", "End date")} />
      <Button variant="ghost" disabled={!has} onClick={() => set({ type: null, from: null, to: null, mission: null, staff: null })}><X className="h-4 w-4" aria-hidden />{t("Effacer", "Clear")}</Button>
    </div>
  );
}
