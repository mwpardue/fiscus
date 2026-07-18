"use server";

import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_COLOR_TAG_TOKEN, isColorTagToken } from "@/lib/color-tags";
import type { Database } from "@/lib/database.types";
import { applyFinancialItemMetadata } from "@/lib/financial-item-metadata";
import { parseMajorAmountToMinor } from "@/lib/money";
import { enforceRateLimit } from "@/lib/rate-limit";
import { generateDueDates, type ScheduleBasis } from "@/lib/recurrence/generated";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ONGOING_MATERIALIZED_OCCURRENCE_COUNT = 12;

const updateEventPlanSchema = z
  .object({
    accountMode: z.enum(["none", "existing", "new"]),
    amountStatus: z.enum(["fixed", "estimated", "unknown"]),
    categoryName: z.string().trim().max(80).optional(),
    colorToken: z.string().trim().optional(),
    counterpartyId: z.string().uuid().optional(),
    counterpartyName: z.string().trim().max(120).optional(),
    counterpartyWebsiteUrl: z
      .string()
      .trim()
      .max(255)
      .optional()
      .transform((value) => normalizeWebsiteUrl(value)),
    eventId: z.string().uuid(),
    expectedAmount: z.string().trim().optional(),
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    returnTo: z.string().trim().optional(),
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

const updateGeneratedScheduleSchema = z
  .object({
    anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    businessDayAdjustment: z.enum([
      "none",
      "previous_business_day",
      "next_business_day"
    ]),
    eventId: z.string().uuid(),
    intervalCount: z.coerce.number().int().min(1).max(24),
    intervalUnit: z.enum(["day", "week", "month", "year"]),
    manualAmountStatuses: z
      .array(z.enum(["fixed", "estimated", "unknown"]))
      .optional(),
    manualExpectedAmounts: z.array(z.string()).optional(),
    manualDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    occurrenceCount: z.coerce.number().int().min(1).max(120).optional(),
    ordinalWeek: z.coerce
      .number()
      .int()
      .refine((value) => value === -1 || (value >= 1 && value <= 4))
      .optional(),
    returnTo: z.string().trim().optional(),
    ruleId: z.string().uuid(),
    scheduleBasis: z.enum(["date", "weekday", "month_weekday"]),
    scheduleMode: z.enum(["ongoing", "finite", "manual"]),
    shortMonthBehavior: z.enum(["last_day", "next_month", "skip"]),
    weekday: z.coerce.number().int().min(0).max(6).optional(),
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).optional()
  })
  .superRefine((value, context) => {
    if (value.scheduleMode === "finite" && !value.occurrenceCount) {
      context.addIssue({
        code: "custom",
        path: ["occurrenceCount"],
        message: "Enter how many events to create."
      });
    }

    if (
      value.scheduleMode === "manual" &&
      (!value.manualDates || value.manualDates.length === 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["manualDates"],
        message: "Enter at least one manual due date."
      });
    }

    if (value.scheduleMode === "manual") {
      return;
    }

    if (!value.anchorDate) {
      context.addIssue({
        code: "custom",
        path: ["anchorDate"],
        message: "Enter a start date."
      });
    }

    if (value.scheduleBasis === "weekday" && value.intervalUnit !== "week") {
      context.addIssue({
        code: "custom",
        path: ["intervalUnit"],
        message: "Weekly weekday schedules must repeat in weeks."
      });
    }

    if (
      value.scheduleBasis === "month_weekday" &&
      value.intervalUnit !== "month"
    ) {
      context.addIssue({
        code: "custom",
        path: ["intervalUnit"],
        message: "Monthly weekday schedules must repeat in months."
      });
    }

    if (value.scheduleBasis !== "date" && value.intervalUnit === "year") {
      context.addIssue({
        code: "custom",
        path: ["intervalUnit"],
        message: "Yearly schedules must use date recurrence."
      });
    }

    if (
      value.scheduleBasis !== "date" &&
      value.weekday === undefined &&
      (!value.weekdays || value.weekdays.length === 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["weekday"],
        message: "Choose a weekday for this schedule."
      });
    }

    if (
      value.scheduleBasis === "month_weekday" &&
      value.ordinalWeek === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["ordinalWeek"],
        message: "Choose which week of the month to use."
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
    counterpartyWebsiteUrl: formData.get("counterpartyWebsiteUrl") || undefined,
    eventId: formData.get("eventId"),
    expectedAmount: formData.get("expectedAmount") || undefined,
    id: formData.get("id"),
    name: formData.get("name"),
    returnTo: formData.get("returnTo") || undefined,
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
    : DEFAULT_COLOR_TAG_TOKEN;
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
    counterpartyWebsiteUrl:
      parsed.data.accountMode === "new"
        ? parsed.data.counterpartyWebsiteUrl
        : undefined,
    planName: parsed.data.name,
    planIconFile: getOptionalFile(formData.get("planIcon")),
    themeToken: null
  });

  revalidatePath("/events");
  revalidatePath(`/events/${parsed.data.eventId}/edit`);
  revalidatePath("/dashboard");
  redirect(
    getSafeReturnTo(
      parsed.data.returnTo,
      `/events/${parsed.data.eventId}/edit` as Route
    )
  );
}

export async function updateGeneratedScheduleAction(formData: FormData) {
  const parsed = updateGeneratedScheduleSchema.safeParse({
    anchorDate: formData.get("anchorDate"),
    businessDayAdjustment: formData.get("businessDayAdjustment") ?? "none",
    eventId: formData.get("eventId"),
    intervalCount: formData.get("intervalCount") ?? "1",
    intervalUnit: formData.get("intervalUnit") ?? "month",
    manualAmountStatuses: formData
      .getAll("manualAmountStatus")
      .map((value) => String(value))
      .filter(Boolean),
    manualExpectedAmounts: formData
      .getAll("manualExpectedAmount")
      .map((value) => String(value)),
    manualDates: formData
      .getAll("manualDate")
      .map((value) => String(value))
      .filter(Boolean),
    occurrenceCount: formData.get("occurrenceCount") || undefined,
    ordinalWeek: formData.get("ordinalWeek") || undefined,
    returnTo: formData.get("returnTo") || undefined,
    ruleId: formData.get("ruleId"),
    scheduleBasis: formData.get("scheduleBasis") ?? "date",
    scheduleMode: formData.get("scheduleMode"),
    shortMonthBehavior: formData.get("shortMonthBehavior") ?? "last_day",
    weekday: formData.get("weekday") || undefined,
    weekdays: formData
      .getAll("weekday")
      .map((value) => String(value))
      .filter(Boolean)
  });

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Check the schedule and try again."
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await enforceRateLimit("planMutation", user.id);

  const {
    anchorDate,
    businessDayAdjustment,
    eventId,
    intervalCount,
    intervalUnit,
    manualAmountStatuses,
    manualExpectedAmounts,
    manualDates,
    occurrenceCount,
    ordinalWeek,
    returnTo,
    ruleId,
    scheduleBasis,
    scheduleMode,
    shortMonthBehavior,
    weekday,
    weekdays
  } = parsed.data;
  const manualRows = (manualDates ?? [])
    .map((date, index) => ({
      amountStatus: manualAmountStatuses?.[index] ?? "unknown",
      date,
      expectedAmount: manualExpectedAmounts?.[index] ?? ""
    }))
    .filter((row) => row.date)
    .sort((left, right) => left.date.localeCompare(right.date));
  const seenManualDates = new Set<string>();
  const uniqueManualRows = manualRows.filter((row) => {
    if (seenManualDates.has(row.date)) {
      return false;
    }
    seenManualDates.add(row.date);
    return true;
  });
  const manualDueDates = uniqueManualRows.map((row) => row.date);

  if (scheduleMode === "manual") {
    const { data: manualRuleId, error } = await supabase.rpc(
      "convert_generated_recurrence_rule_to_manual",
      {
        p_due_dates: manualDueDates,
        p_reason: "Schedule converted to manual from event edit page",
        p_rule_id: ruleId
      }
    );

    if (error) {
      throw new Error("Unable to convert that schedule to manual.");
    }

    const overrideError = await applyManualOccurrenceOverrides(supabase, {
      manualRows: uniqueManualRows,
      recurrenceRuleId: manualRuleId,
      userId: user.id
    });

    if (overrideError) {
      throw new Error(overrideError);
    }

    revalidatePath("/events");
    revalidatePath(`/events/${eventId}/edit`);
    revalidatePath("/dashboard");
    redirect(getSafeReturnTo(returnTo, `/events/${eventId}/edit` as Route));
  }

  const generatedAnchorDate = anchorDate ?? "";
  const generatedCount =
    scheduleMode === "finite"
      ? occurrenceCount ?? 0
      : ONGOING_MATERIALIZED_OCCURRENCE_COUNT;
  const activeWeekdays =
    scheduleBasis === "weekday"
      ? Array.from(
          new Set(
            (weekdays?.length ? weekdays : [weekday]).filter(
              (value): value is number => typeof value === "number"
            )
          )
        )
      : [weekday ?? null];
  const primaryWeekday = activeWeekdays[0] ?? weekday ?? null;
  const dueDates = generateDueDates({
    anchorDate: generatedAnchorDate,
    businessDayAdjustment,
    count: generatedCount,
    intervalCount,
    intervalUnit,
    ordinalWeek: ordinalWeek ?? null,
    scheduleBasis: scheduleBasis as ScheduleBasis,
    shortMonthBehavior,
    weekday: primaryWeekday
  });

  if (dueDates.length === 0) {
    throw new Error("Check the schedule dates and try again.");
  }

  const anchorDay = Number(generatedAnchorDate.slice(8, 10));
  const { error } = await supabase.rpc("update_generated_recurrence_rule", {
    p_anchor_date: generatedAnchorDate,
    p_anchor_day:
      (intervalUnit === "month" || intervalUnit === "year") &&
      scheduleBasis === "date"
        ? anchorDay
        : null,
    p_anchor_weekday: scheduleBasis === "date" ? null : primaryWeekday,
    p_business_day_adjustment: businessDayAdjustment,
    p_due_dates: dueDates,
    p_interval_count: intervalCount,
    p_interval_unit: intervalUnit,
    p_mode: scheduleMode,
    p_occurrence_count: scheduleMode === "finite" ? generatedCount : null,
    p_ordinal_week:
      scheduleBasis === "month_weekday" ? ordinalWeek ?? null : null,
    p_reason: "Schedule edited from event edit page",
    p_rule_id: ruleId,
    p_schedule_basis: scheduleBasis,
    p_short_month_behavior:
      intervalUnit === "month" || intervalUnit === "year"
        ? shortMonthBehavior
        : null
  });

  if (error) {
    throw new Error("Unable to update that schedule.");
  }

  const { error: siblingError } = await supabase.rpc(
    "supersede_sibling_generated_recurrence_rules",
    {
      p_keep_rule_id: ruleId,
      p_reason: "Schedule edited from event edit page"
    }
  );

  if (siblingError) {
    throw new Error("Unable to replace sibling schedules.");
  }

  const { data: rule } = await supabase
    .from("recurrence_rules")
    .select("financial_item_id")
    .eq("id", ruleId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!rule) {
    throw new Error("Unable to load that schedule.");
  }

  if (scheduleBasis === "weekday" && activeWeekdays.length > 1) {
    for (const extraWeekday of activeWeekdays.slice(1)) {
      const extraDueDates = generateDueDates({
        anchorDate: generatedAnchorDate,
        businessDayAdjustment,
        count: generatedCount,
        intervalCount,
        intervalUnit,
        ordinalWeek: ordinalWeek ?? null,
        scheduleBasis,
        shortMonthBehavior,
        weekday: extraWeekday
      });

      const { error: scheduleError } = await supabase.rpc(
        "add_generated_schedule_to_financial_item",
        {
          p_anchor_date: generatedAnchorDate,
          p_anchor_day: null,
          p_anchor_weekday: extraWeekday,
          p_business_day_adjustment: businessDayAdjustment,
          p_due_dates: extraDueDates,
          p_financial_item_id: rule.financial_item_id,
          p_interval_count: intervalCount,
          p_interval_unit: intervalUnit,
          p_mode: scheduleMode,
          p_occurrence_count:
            scheduleMode === "finite" ? generatedCount : null,
          p_ordinal_week: null,
          p_schedule_basis: scheduleBasis,
          p_short_month_behavior: null
        }
      );

      if (scheduleError) {
        throw new Error("Unable to add that schedule.");
      }
    }
  }

  revalidatePath("/events");
  revalidatePath(`/events/${eventId}/edit`);
  revalidatePath("/dashboard");
  redirect(getSafeReturnTo(returnTo, `/events/${eventId}/edit` as Route));
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

async function applyManualOccurrenceOverrides(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  {
    manualRows,
    recurrenceRuleId,
    userId
  }: {
    manualRows: Array<{
      amountStatus: string;
      date: string;
      expectedAmount: string;
    }>;
    recurrenceRuleId: string;
    userId: string;
  }
) {
  const { data: occurrences, error } = await supabase
    .from("occurrences")
    .select("id")
    .eq("recurrence_rule_id", recurrenceRuleId)
    .eq("user_id", userId)
    .order("sequence_number", { ascending: true });

  if (error) {
    return "Unable to load manual events.";
  }

  for (const [index, occurrence] of (occurrences ?? []).entries()) {
    const row = manualRows[index];
    const status = row?.amountStatus ?? "unknown";
    const amount =
      status === "unknown"
        ? null
        : parseMajorAmountToMinor(row?.expectedAmount ?? "");

    if (status !== "unknown" && amount === null) {
      return `Enter a valid amount for ${row?.date ?? "manual date"}.`;
    }

    const { error: updateError } = await supabase
      .from("occurrences")
      .update({
        amount_status: status as Database["public"]["Enums"]["amount_status"],
        expected_amount_minor: amount
      })
      .eq("id", occurrence.id)
      .eq("user_id", userId);

    if (updateError) {
      return "Unable to update manual event amounts.";
    }
  }

  return null;
}

function getOptionalFile(value: FormDataEntryValue | null) {
  return value instanceof File ? value : null;
}

function getSafeReturnTo(
  returnTo: string | undefined,
  fallback: Route
): Route {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return fallback;
  }

  if (
    returnTo === "/dashboard" ||
    returnTo.startsWith("/dashboard?") ||
    returnTo === "/events" ||
    /^\/accounts\/[0-9a-f-]+\/edit$/i.test(returnTo)
  ) {
    return returnTo as Route;
  }

  return fallback;
}

function normalizeWebsiteUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
    return parsed.origin;
  } catch {
    return null;
  }
}
