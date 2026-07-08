"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isThemeToken } from "@/lib/color-tags";
import type { Json } from "@/lib/database.types";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const weekStartSchema = z.object({
  weekStartsOn: z.coerce.number().int().min(0).max(6)
});

const themeSchema = z.object({
  themeToken: z.string().refine(isThemeToken)
});

const backupSchema = z.object({
  data: z.object({}).passthrough(),
  schema: z.literal("fiscus.user-backup.v1")
}).passthrough();

export async function updateWeekStartAction(formData: FormData) {
  const parsed = weekStartSchema.safeParse({
    weekStartsOn: formData.get("weekStartsOn")
  });

  if (!parsed.success) {
    throw new Error("Choose a valid week start day.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await enforceRateLimit("profileMutation", user.id);

  const { error } = await supabase
    .from("profiles")
    .update({ week_starts_on: parsed.data.weekStartsOn })
    .eq("user_id", user.id);

  if (error) {
    throw new Error("Unable to update week settings.");
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/settings");
}

export async function updateThemeAction(formData: FormData) {
  const parsed = themeSchema.safeParse({
    themeToken: formData.get("themeToken")
  });

  if (!parsed.success) {
    throw new Error("Choose a valid theme.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await enforceRateLimit("profileMutation", user.id);

  const { error } = await supabase
    .from("profiles")
    .update({ theme_token: parsed.data.themeToken })
    .eq("user_id", user.id);

  if (error) {
    throw new Error("Unable to update theme settings.");
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/events");
  revalidatePath("/entries");
  redirect("/settings");
}

export async function restoreBackupAction(formData: FormData) {
  const file = formData.get("backupFile");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a Fiscus backup JSON file.");
  }

  const rawBackup = await file.text();
  let backup: unknown;

  try {
    backup = JSON.parse(rawBackup);
  } catch {
    throw new Error("Backup file must be valid JSON.");
  }

  const parsed = backupSchema.safeParse(backup);

  if (!parsed.success) {
    throw new Error("Backup file is not a supported Fiscus backup.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await enforceRateLimit("profileMutation", user.id);

  const { error } = await supabase.rpc("restore_user_backup", {
    p_backup: parsed.data as Json
  });

  if (error) {
    throw new Error("Unable to restore that backup.");
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/events");
  revalidatePath("/entries");
  redirect("/settings");
}
