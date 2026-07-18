import type { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateDueDates, type ScheduleBasis } from "./generated";

type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;

type OngoingRule = {
  anchor_date: string | null;
  anchor_weekday: number | null;
  business_day_adjustment:
    | "none"
    | "previous_business_day"
    | "next_business_day";
  id: string;
  interval_count: number | null;
  interval_unit: "day" | "week" | "month" | "year" | null;
  ordinal_week: number | null;
  schedule_basis: string;
  short_month_behavior: "last_day" | "next_month" | "skip" | null;
};

export async function ensureOngoingOccurrencesThrough(
  supabase: ServerSupabaseClient,
  visibleEnd: string
) {
  const { data: rules } = await supabase
    .from("recurrence_rules")
    .select(
      "id,anchor_date,anchor_weekday,business_day_adjustment,interval_count,interval_unit,ordinal_week,schedule_basis,short_month_behavior"
    )
    .eq("mode", "ongoing")
    .eq("status", "active");
  const ongoingRules = (rules ?? []) as OngoingRule[];

  if (ongoingRules.length === 0) {
    return;
  }

  const { data: occurrences } = await supabase
    .from("occurrences")
    .select("recurrence_rule_id,due_date")
    .in(
      "recurrence_rule_id",
      ongoingRules.map((rule) => rule.id)
    )
    .is("archived_at", null)
    .order("due_date", { ascending: true });
  const maxDueDateByRule = new Map<string, string>();

  for (const occurrence of occurrences ?? []) {
    if (!occurrence.recurrence_rule_id) {
      continue;
    }

    maxDueDateByRule.set(occurrence.recurrence_rule_id, occurrence.due_date);
  }

  for (const rule of ongoingRules) {
    const maxDueDate = maxDueDateByRule.get(rule.id);

    if (
      !rule.anchor_date ||
      !rule.interval_unit ||
      !rule.interval_count ||
      (maxDueDate && maxDueDate >= visibleEnd)
    ) {
      continue;
    }

    const dueDates = generateDueDatesThrough(rule, visibleEnd).filter(
      (date) => (!maxDueDate || date > maxDueDate) && date <= visibleEnd
    );

    if (dueDates.length === 0) {
      continue;
    }

    await supabase.rpc("add_generated_occurrences_to_rule", {
      p_due_dates: dueDates,
      p_reason: "Extended from dashboard calendar view",
      p_rule_id: rule.id
    });
  }
}

function generateDueDatesThrough(rule: OngoingRule, visibleEnd: string) {
  let count = 12;
  let dates: string[] = [];

  while (count <= 5000) {
    dates = generateDueDates({
      anchorDate: rule.anchor_date ?? "",
      businessDayAdjustment: rule.business_day_adjustment,
      count,
      intervalCount: rule.interval_count ?? 1,
      intervalUnit: rule.interval_unit ?? "month",
      ordinalWeek: rule.ordinal_week,
      scheduleBasis: rule.schedule_basis as ScheduleBasis,
      shortMonthBehavior: rule.short_month_behavior ?? "last_day",
      weekday: rule.anchor_weekday
    });

    if (dates.at(-1) && dates.at(-1)! >= visibleEnd) {
      break;
    }

    count *= 2;
  }

  return dates;
}
