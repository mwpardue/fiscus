"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isColorTagToken } from "@/lib/color-tags";
import { applyFinancialItemMetadata } from "@/lib/financial-item-metadata";
import { parseMajorAmountToMinor } from "@/lib/money";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const updateEventPlanSchema = z
  .object({
    accountMode: z.enum(["none", "existing", "new"]),
    amountStatus: z.enum(["fixed", "estimated", "unknown"]),
    categoryName: z.string().trim().max(80).optional(),
    colorToken: z.string().trim().optional(),
    counterpartyId: z.string().uuid().optional(),
    counterpartyName: z.string().trim().max(120).optional(),
    eventId: z.string().uuid(),
    expectedAmount: z.string().trim().optional(),
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    updateFutureAmounts: z.boolean()
  })
  .superRefine((value, context) => {
    if (value.accountMode === "existing" && !value.counterpartyId) {
      context.addIssue({
        code: "custom",
        path: ["counterpartyId"],
        message: "Choose an existing account."
      });
    }

    if (value.accountMode === "new" && !value.counterpartyName) {
      context.addIssue({
        code: "custom",
        path: ["counterpartyName"],
        message: "Enter the new account name."
      });
    }
  });

export async function updateEventPlanAction(formData: FormData) {
  const parsed = updateEventPlanSchema.safeParse({
    accountMode: formData.get("accountMode") ?? "none",
    amountStatus: formData.get("amountStatus"),
    categoryName: formData.get("categoryName") || undefined,
    colorToken: formData.get("colorToken") || undefined,
    counterpartyId: formData.get("counterpartyId") || undefined,
    counterpartyName: formData.get("counterpartyName") || undefined,
    eventId: formData.get("eventId"),
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

  const { error } = await supabase
    .from("financial_items")
    .update({
      color_token: colorToken,
      default_amount_status: parsed.data.amountStatus,
      default_expected_amount_minor: expectedAmountMinor,
      name: parsed.data.name,
      theme_token: null
    })
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
    accountIconFile:
      parsed.data.accountMode === "new"
        ? getOptionalFile(formData.get("accountIcon"))
        : null,
    categoryName: parsed.data.categoryName,
    colorToken,
    counterpartyId:
      parsed.data.accountMode === "existing"
        ? parsed.data.counterpartyId ?? null
        : parsed.data.accountMode === "none"
          ? null
          : undefined,
    counterpartyName:
      parsed.data.accountMode === "new"
        ? parsed.data.counterpartyName
        : undefined,
    planName: parsed.data.name,
    planIconFile: getOptionalFile(formData.get("planIcon")),
    themeToken: null
  });

  revalidatePath("/events");
  revalidatePath(`/events/${parsed.data.eventId}/edit`);
  revalidatePath("/dashboard");
  redirect(`/events/${parsed.data.eventId}/edit`);
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

function getOptionalFile(value: FormDataEntryValue | null) {
  return value instanceof File ? value : null;
}
