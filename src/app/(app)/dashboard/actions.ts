"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  parseMajorAmountToMinor,
  parseSignedMajorAmountToMinor
} from "@/lib/money";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const completeOccurrenceSchema = z.object({
  occurrenceId: z.string().uuid(),
  amount: z.string().trim().min(1),
  completedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const balanceAnchorSchema = z.object({
  balance: z.string().trim().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional()
});

export async function completeOccurrenceAction(formData: FormData) {
  const parsed = completeOccurrenceSchema.safeParse({
    occurrenceId: formData.get("occurrenceId"),
    amount: formData.get("amount"),
    completedOn: formData.get("completedOn")
  });

  if (!parsed.success) {
    throw new Error("Enter a valid completion amount and date.");
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
    p_occurrence_id: parsed.data.occurrenceId,
    p_amount_minor: amountMinor,
    p_completed_on: parsed.data.completedOn,
    p_reason: null
  });

  if (error) {
    throw new Error("Unable to complete that event.");
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateBalanceAnchorAction(formData: FormData) {
  const parsed = balanceAnchorSchema.safeParse({
    balance: formData.get("balance"),
    month: formData.get("month") || undefined
  });

  if (!parsed.success) {
    throw new Error("Enter a valid checking balance.");
  }

  const balanceMinor = parseSignedMajorAmountToMinor(parsed.data.balance);

  if (balanceMinor === null) {
    throw new Error("Enter a valid checking balance.");
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
    .update({
      balance_anchor_amount_minor: balanceMinor,
      balance_anchor_recorded_at: new Date().toISOString()
    })
    .eq("user_id", user.id);

  if (error) {
    throw new Error("Unable to update checking balance.");
  }

  revalidatePath("/dashboard");
  redirect(
    parsed.data.month ? `/dashboard?month=${parsed.data.month}` : "/dashboard"
  );
}
