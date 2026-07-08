"use server";

import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseMajorAmountToMinor } from "@/lib/money";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const updateOccurrenceSchema = z.object({
  amountStatus: z.enum(["fixed", "estimated", "unknown"]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedAmount: z.string().trim().optional(),
  id: z.string().uuid(),
  notes: z.string().trim().max(1000).optional()
});

const archiveOccurrenceSchema = z.object({
  id: z.string().uuid(),
  returnTo: z.string().optional()
});

const completeOccurrenceSchema = z.object({
  amount: z.string().trim().min(1),
  completedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  id: z.string().uuid(),
  returnTo: z.string().optional()
});

const reopenOccurrenceSchema = z.object({
  id: z.string().uuid(),
  returnTo: z.string().optional()
});

export async function updateOccurrenceAction(formData: FormData) {
  const parsed = updateOccurrenceSchema.safeParse({
    amountStatus: formData.get("amountStatus"),
    dueDate: formData.get("dueDate"),
    expectedAmount: formData.get("expectedAmount") || undefined,
    id: formData.get("id"),
    notes: formData.get("notes") || undefined
  });

  if (!parsed.success) {
    throw new Error("Check the event details and try again.");
  }

  const expectedAmountMinor =
    parsed.data.amountStatus === "unknown"
      ? null
      : parseMajorAmountToMinor(parsed.data.expectedAmount ?? "");

  if (parsed.data.amountStatus !== "unknown" && expectedAmountMinor === null) {
    throw new Error("Enter a valid expected amount.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await enforceRateLimit("eventMutation", user.id);

  const { error } = await supabase
    .from("occurrences")
    .update({
      amount_status: parsed.data.amountStatus,
      due_date: parsed.data.dueDate,
      expected_amount_minor: expectedAmountMinor,
      notes: parsed.data.notes ?? null
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error("Unable to update that event.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/events");
  revalidatePath(`/events/${parsed.data.id}/edit`);
  redirect(`/events/${parsed.data.id}/edit`);
}

export async function archiveOccurrenceAction(formData: FormData) {
  const parsed = archiveOccurrenceSchema.safeParse({
    id: formData.get("id"),
    returnTo: formData.get("returnTo") || undefined
  });

  if (!parsed.success) {
    throw new Error("Choose a valid event to archive.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await enforceRateLimit("eventMutation", user.id);

  const { error } = await supabase.rpc("archive_occurrence", {
    p_occurrence_id: parsed.data.id,
    p_reason: "Archived from event edit"
  });

  if (error) {
    throw new Error("Unable to delete that event.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/events");
  redirect(getSafeReturnPath(parsed.data.returnTo, "/events"));
}

export async function completeOccurrenceFromCardAction(formData: FormData) {
  const parsed = completeOccurrenceSchema.safeParse({
    amount: formData.get("amount"),
    completedOn: formData.get("completedOn"),
    id: formData.get("id"),
    returnTo: formData.get("returnTo") || undefined
  });

  if (!parsed.success) {
    throw new Error("Check the event details and try again.");
  }

  const amountMinor = parseMajorAmountToMinor(parsed.data.amount);

  if (amountMinor === null) {
    throw new Error("Enter a valid completion amount.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await enforceRateLimit("eventMutation", user.id);

  const { error } = await supabase.rpc("complete_occurrence", {
    p_occurrence_id: parsed.data.id,
    p_amount_minor: amountMinor,
    p_completed_on: parsed.data.completedOn,
    p_reason: null
  });

  if (error) {
    throw new Error("Unable to complete that event.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/events");
  redirect(getSafeReturnPath(parsed.data.returnTo, "/dashboard"));
}

export async function reopenOccurrenceFromCardAction(formData: FormData) {
  const parsed = reopenOccurrenceSchema.safeParse({
    id: formData.get("id"),
    returnTo: formData.get("returnTo") || undefined
  });

  if (!parsed.success) {
    throw new Error("Choose a valid event to reopen.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await enforceRateLimit("eventMutation", user.id);

  const { error } = await supabase.rpc("reopen_occurrence", {
    p_occurrence_id: parsed.data.id,
    p_reason: "Reopened from event card"
  });

  if (error) {
    throw new Error("Unable to reopen that event.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/events");
  redirect(getSafeReturnPath(parsed.data.returnTo, "/dashboard"));
}

function getSafeReturnPath(value: string | undefined, fallback: Route): Route {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  if (
    value === "/dashboard" ||
    value.startsWith("/dashboard?") ||
    value === "/events"
  ) {
    return value as Route;
  }

  return fallback;
}
