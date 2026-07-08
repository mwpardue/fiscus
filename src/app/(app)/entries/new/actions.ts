"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isColorTagToken } from "@/lib/color-tags";
import type { Database } from "@/lib/database.types";
import { applyFinancialItemMetadata } from "@/lib/financial-item-metadata";
import { parseMajorAmountToMinor } from "@/lib/money";
import { enforceRateLimit } from "@/lib/rate-limit";
import { generateDueDates, type ScheduleBasis } from "@/lib/recurrence/generated";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const newEntrySchema = z
  .object({
    kind: z.enum(["bill", "income"]),
    name: z.string().trim().min(1).max(120),
    accountMode: z.enum(["none", "existing", "new"]),
    counterpartyId: z.string().uuid().optional(),
    categoryName: z.string().trim().max(80).optional(),
    colorToken: z.string().trim().optional(),
    counterpartyName: z.string().trim().max(120).optional(),
    amountStatus: z.enum(["fixed", "estimated", "unknown"]),
    expectedAmount: z.string().trim().optional(),
    scheduleMode: z.enum(["ongoing", "finite", "manual"]),
    scheduleBasis: z.enum(["date", "weekday", "month_weekday"]),
    intervalUnit: z.enum(["day", "week", "month", "year"]),
    intervalCount: z.coerce.number().int().min(1).max(24),
    occurrenceCount: z.coerce.number().int().min(1).max(120).optional(),
    anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    manualAmountStatuses: z.array(z.enum(["fixed", "estimated", "unknown"])).optional(),
    manualExpectedAmounts: z.array(z.string()).optional(),
    manualDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    weekday: z.coerce.number().int().min(0).max(6).optional(),
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).optional(),
    ordinalWeek: z.coerce.number().int().refine((value) => value === -1 || (value >= 1 && value <= 4)).optional(),
    shortMonthBehavior: z.enum(["last_day", "next_month", "skip"]),
    currencyCode: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase())
  })
  .superRefine((value, context) => {
    if (value.amountStatus !== "unknown" && !value.expectedAmount) {
      context.addIssue({
        code: "custom",
        path: ["expectedAmount"],
        message: "Enter an amount or mark it unknown."
      });
    } else if (
      value.amountStatus !== "unknown" &&
      parseMajorAmountToMinor(value.expectedAmount ?? "") === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["expectedAmount"],
        message: "Enter a valid amount with up to two decimals."
      });
    }

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

    if (
      value.colorToken &&
      !isColorTagToken(value.colorToken)
    ) {
      context.addIssue({
        code: "custom",
        path: ["colorToken"],
        message: "Choose a valid color tag."
      });
    }

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
        message: "Enter a first due date."
      });
    }

    if (value.scheduleBasis === "weekday" && value.intervalUnit !== "week") {
      context.addIssue({
        code: "custom",
        path: ["intervalUnit"],
        message: "Weekday schedules repeat in weeks."
      });
    }

    if (value.scheduleBasis === "month_weekday" && value.intervalUnit !== "month") {
      context.addIssue({
        code: "custom",
        path: ["intervalUnit"],
        message: "Monthly weekday schedules repeat in months."
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

export type NewEntryActionState = {
  message?: string;
  status: "idle" | "error";
};

export async function createEntryAction(
  _previousState: NewEntryActionState,
  formData: FormData
): Promise<NewEntryActionState> {
  const parsed = newEntrySchema.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    accountMode: formData.get("accountMode") ?? "none",
    counterpartyId: formData.get("counterpartyId") || undefined,
    categoryName: formData.get("categoryName") || undefined,
    colorToken: formData.get("colorToken") || undefined,
    counterpartyName: formData.get("counterpartyName") || undefined,
    amountStatus: formData.get("amountStatus"),
    expectedAmount: formData.get("expectedAmount") || undefined,
    scheduleMode: formData.get("scheduleMode"),
    scheduleBasis: formData.get("scheduleBasis") ?? "date",
    intervalUnit: formData.get("intervalUnit") ?? "day",
    intervalCount: formData.get("intervalCount") ?? "1",
    occurrenceCount: formData.get("occurrenceCount") || undefined,
    anchorDate: formData.get("anchorDate") || undefined,
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
    weekday: formData.get("weekday") || undefined,
    weekdays: formData
      .getAll("weekday")
      .map((value) => String(value))
      .filter(Boolean),
    ordinalWeek: formData.get("ordinalWeek") || undefined,
    shortMonthBehavior: formData.get("shortMonthBehavior"),
    currencyCode: formData.get("currencyCode")
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the form and try again."
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    await enforceRateLimit("planMutation", user.id);
  } catch (error) {
    return { status: "error", message: getErrorMessage(error) };
  }

  const {
    kind,
    name,
    accountMode,
    counterpartyId,
    categoryName,
    colorToken,
    counterpartyName,
    amountStatus,
    expectedAmount,
    scheduleMode,
    scheduleBasis,
    intervalUnit,
    intervalCount,
    occurrenceCount,
    anchorDate,
    manualAmountStatuses,
    manualExpectedAmounts,
    manualDates,
    weekday,
    weekdays,
    ordinalWeek,
    shortMonthBehavior,
    currencyCode
  } = parsed.data;
  const expectedAmountMinor =
    amountStatus === "unknown"
      ? null
      : parseMajorAmountToMinor(expectedAmount ?? "");
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
  const metadata = {
    accountIconFile: getOptionalFile(formData.get("accountIcon")),
    categoryName,
    colorToken: isColorTagToken(colorToken) ? colorToken : null,
    counterpartyId: accountMode === "existing" ? counterpartyId ?? null : undefined,
    counterpartyName: accountMode === "new" ? counterpartyName : undefined,
    planName: name,
    planIconFile: getOptionalFile(formData.get("planIcon")),
    themeToken: null
  };

  if (scheduleMode === "manual") {
    if (
      manualDueDates.length === 0 ||
      (expectedAmountMinor === null && amountStatus !== "unknown")
    ) {
      return {
        status: "error",
        message: "Enter at least one valid manual due date."
      };
    }

    const { data: financialItemId, error } = await supabase.rpc("create_manual_financial_item", {
      p_kind: kind,
      p_name: name,
      p_default_amount_status: amountStatus,
      p_default_expected_amount_minor: expectedAmountMinor,
      p_currency_code: currencyCode,
      p_due_dates: manualDueDates
    });

    if (error) {
      return {
        status: "error",
        message: "Unable to create that manual plan."
      };
    }

    try {
      await applyFinancialItemMetadata(supabase, user.id, financialItemId, metadata);
    } catch (error) {
      return { status: "error", message: getErrorMessage(error) };
    }

    const overrideError = await applyManualOccurrenceOverrides(supabase, {
      financialItemId,
      manualRows: uniqueManualRows,
      userId: user.id
    });

    if (overrideError) {
      return { status: "error", message: overrideError };
    }

    redirect("/events");
  }

  const generatedCount = scheduleMode === "finite" ? occurrenceCount ?? 0 : 12;
  const generatedAnchorDate = anchorDate ?? "";
  const activeWeekdays =
    scheduleBasis === "weekday"
      ? Array.from(new Set((weekdays?.length ? weekdays : [weekday]).filter(
          (value): value is number => typeof value === "number"
        )))
      : [weekday ?? null];
  const primaryWeekday = activeWeekdays[0] ?? weekday ?? null;
  const dueDates = generateDueDates({
    anchorDate: generatedAnchorDate,
    count: generatedCount,
    intervalCount,
    intervalUnit,
    ordinalWeek: ordinalWeek ?? null,
    scheduleBasis: scheduleBasis as ScheduleBasis,
    shortMonthBehavior,
    weekday: primaryWeekday
  });
  const anchorDay = Number(generatedAnchorDate.slice(8, 10));

  if (
    dueDates.length === 0 ||
    (expectedAmountMinor === null && amountStatus !== "unknown")
  ) {
    return {
      status: "error",
      message: "Check the schedule and amount, then try again."
    };
  }

  const { data: financialItemId, error } = await supabase.rpc("create_generated_financial_item", {
    p_kind: kind,
    p_name: name,
    p_default_amount_status: amountStatus,
    p_default_expected_amount_minor: expectedAmountMinor,
    p_currency_code: currencyCode,
    p_mode: scheduleMode,
    p_interval_unit: intervalUnit,
    p_interval_count: intervalCount,
    p_anchor_date: generatedAnchorDate,
    p_anchor_day:
      (intervalUnit === "month" || intervalUnit === "year") &&
      scheduleBasis === "date"
        ? anchorDay
        : null,
    p_short_month_behavior:
      intervalUnit === "month" || intervalUnit === "year"
        ? shortMonthBehavior
        : null,
    p_occurrence_count: scheduleMode === "finite" ? generatedCount : null,
    p_due_dates: dueDates,
    p_schedule_basis: scheduleBasis,
    p_anchor_weekday: scheduleBasis === "date" ? null : primaryWeekday,
    p_ordinal_week:
      scheduleBasis === "month_weekday" ? ordinalWeek ?? null : null
  });

  if (error) {
    return {
      status: "error",
      message: "Unable to create that generated plan."
    };
  }

  try {
    await applyFinancialItemMetadata(supabase, user.id, financialItemId, metadata);
  } catch (error) {
    return { status: "error", message: getErrorMessage(error) };
  }

  if (scheduleBasis === "weekday" && activeWeekdays.length > 1) {
    for (const extraWeekday of activeWeekdays.slice(1)) {
      const extraDueDates = generateDueDates({
        anchorDate: generatedAnchorDate,
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
          p_financial_item_id: financialItemId,
          p_mode: scheduleMode,
          p_interval_unit: intervalUnit,
          p_interval_count: intervalCount,
          p_anchor_date: generatedAnchorDate,
          p_anchor_day: null,
          p_short_month_behavior: null,
          p_occurrence_count:
            scheduleMode === "finite" ? generatedCount : null,
          p_due_dates: extraDueDates,
          p_schedule_basis: scheduleBasis,
          p_anchor_weekday: extraWeekday,
          p_ordinal_week: null
        }
      );

    if (scheduleError) {
        return { status: "error", message: "Unable to add that schedule." };
      }
    }
  }

  redirect("/events");
}

async function applyManualOccurrenceOverrides(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  {
    financialItemId,
    manualRows,
    userId
  }: {
    financialItemId: string;
    manualRows: Array<{
      amountStatus: string;
      date: string;
      expectedAmount: string;
    }>;
    userId: string;
  }
) {
  const { data: occurrences, error } = await supabase
    .from("occurrences")
    .select("id")
    .eq("financial_item_id", financialItemId)
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to save plan metadata.";
}

function getOptionalFile(value: FormDataEntryValue | null) {
  return value instanceof File ? value : null;
}
