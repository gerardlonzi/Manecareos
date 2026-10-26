"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { uuidSchema } from "@/lib/validation";
import { withSession } from "./helpers";

export async function markNotificationRead(id: string): Promise<ActionResult> {
  return withSession(async ({ supabase }) => {
    if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Identifiant invalide" };
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
    if (error) return { ok: false, error: "Opération impossible." };
    revalidatePath("/notifications");
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  return withSession(async ({ supabase }) => {
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    if (error) return { ok: false, error: "Opération impossible." };
    revalidatePath("/notifications");
    revalidatePath("/", "layout");
    return { ok: true, message: "Tout est marqué comme lu" };
  });
}

export async function deleteNotification(id: string): Promise<ActionResult> {
  return withSession(async ({ supabase }) => {
    if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Identifiant invalide" };
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) return { ok: false, error: "Suppression impossible." };
    revalidatePath("/notifications");
    revalidatePath("/", "layout");
    return { ok: true, message: "Notification supprimée" };
  });
}

export async function deleteReadNotifications(): Promise<ActionResult> {
  return withSession(async ({ supabase }) => {
    const { error } = await supabase.from("notifications").delete().not("read_at", "is", null);
    if (error) return { ok: false, error: "Suppression impossible." };
    revalidatePath("/notifications");
    revalidatePath("/", "layout");
    return { ok: true, message: "Notifications lues supprimées" };
  });
}
