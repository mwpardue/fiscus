"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isColorTagToken } from "@/lib/color-tags";
import { applyFinancialItemMetadata } from "@/lib/financial-item-metadata";
import { parseMajorAmountToMinor } from "@/lib/money";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const updateEntrySchema = z.object({
  amountStatus: z.enum(["fixed", "estimated", "unknown"]),
  categoryName: z.string().trim().max(80).optional(),
  colorToken: z.string().trim().optional(),
  counterpartyName: z.string().trim().max(120).optional(),
  expectedAmount: z.string().trim().optional(),
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  updateFutureAmounts: z.boolean()
});

const archiveEntrySchema = z.object({
  id: z.string().uuid()
});

export async function updateEntryAction(formData: FormData) {
  const parsed = updateEntrySchema.safeParse({
    amountStatus: formData.get("amountStatus"),
    categoryName: formData.get("categoryName") || undefined,
    colorToken: formData.get("colorToken") || undefined,
    counterpartyName: formData.get("counterpartyName") || undefined,
    expectedAmount: formData.get("expectedAmount") || undefined,
    id: formData.get("id"),
    name: formData.get("name"),
    updateFutureAmounts: formData.get("updateFutureAmounts") === "on"
  });

  if (!parsed.success) {
    throw new Error("Check the plan details and try again.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await enforceRateLimit("planMutation", user.id);

  const colorToken = isColorTagToken(parsed.data.colorToken)
    ? parsed.data.colorToken
    : null;
  const expectedAmountMinor =
    parsed.data.amountStatus === "unknown"
      ? null
      : parseMajorAmountToMinor(parsed.data.expectedAmount ?? "");

  if (parsed.data.amountStatus !== "unknown" && expectedAmountMinor === null) {
    throw new Error("Enter a valid amount.");
  }

  const updateValues = {
    color_token: colorToken,
    default_amount_status: parsed.data.amountStatus,
    default_expected_amount_minor: expectedAmountMinor,
    name: parsed.data.name,
    theme_token: null
  } as {
    color_token: string | null;
    default_amount_status: "fixed" | "estimated" | "unknown";
    default_expected_amount_minor: number | null;
    name: string;
    theme_token: string | null;
  };

  const { error } = await supabase
    .from("financial_items")
    .update(updateValues)
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error("Unable to update that plan.");
  }

  if (parsed.data.updateFutureAmounts) {
    const today = new Date().toISOString().slice(0, 10);
    const { error: occurrenceAmountError } = await supabase
      .from("occurrences")
      .update({
        amount_status: parsed.data.amountStatus,
        expected_amount_minor: expectedAmountMinor
      })
      .eq("financial_item_id", parsed.data.id)
      .eq("user_id", user.id)
      .eq("lifecycle_status", "upcoming")
      .is("archived_at", null)
      .gte("due_date", today);

    if (occurrenceAmountError) {
      throw new Error("Unable to update future event amounts.");
    }
  }

  const occurrenceDateError = await updateFutureOccurrenceDates(
    formData,
    parsed.data.id,
    user.id
  );

  if (occurrenceDateError) {
    throw new Error(occurrenceDateError);
  }

  await applyFinancialItemMetadata(supabase, user.id, parsed.data.id, {
    accountIconFile: getOptionalFile(formData.get("accountIcon")),
    categoryName: parsed.data.categoryName,
    colorToken,
    counterpartyName: parsed.data.counterpartyName,
    planName: parsed.data.name,
    planIconFile: getOptionalFile(formData.get("planIcon")),
    themeToken: null
  });

  revalidatePath("/entries");
  revalidatePath("/events");
  revalidatePath(`/entries/${parsed.data.id}/edit`);
  revalidatePath("/dashboard");
  redirect("/events");
}

async function updateFutureOccurrenceDates(
  formData: FormData,
  financialItemId: string,
  userId: string
) {
  const supabase = await createServerSupabaseClient();
  const dueDateEntries = Array.from(formData.entries()).filter(([key]) =>
    key.startsWith("occurrenceDueDate:")
  );

  for (const [key, value] of dueDateEntries) {
    const occurrenceId = key.replace("occurrenceDueDate:", "");
    const dueDate = String(value);

    if (
      !z.string().uuid().safeParse(occurrenceId).success ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)
    ) {
      return "Choose valid future event dates.";
    }

    const { error } = await supabase
      .from("occurrences")
      .update({ due_date: dueDate })
      .eq("id", occurrenceId)
      .eq("financial_item_id", financialItemId)
      .eq("user_id", userId)
      .eq("lifecycle_status", "upcoming")
      .is("archived_at", null);

    if (error) {
      return "Unable to update future event dates.";
    }
  }

  return null;
}

export async function archiveEntryAction(formData: FormData) {
  const parsed = archiveEntrySchema.safeParse({
    id: formData.get("id")
  });

  if (!parsed.success) {
    throw new Error("Choose a valid plan to archive.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await enforceRateLimit("planMutation", user.id);

  const { error } = await supabase.rpc("archive_financial_item", {
    p_financial_item_id: parsed.data.id,
    p_hide_archived_history: false,
    p_reason: "Archived from plans screen"
  });

  if (error) {
    throw new Error("Unable to archive that plan.");
  }

  revalidatePath("/entries");
  revalidatePath("/events");
  revalidatePath("/dashboard");
  redirect("/events");
}

function getOptionalFile(value: FormDataEntryValue | null) {
  return value instanceof File ? value : null;
}
