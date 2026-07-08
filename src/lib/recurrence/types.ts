import type { Enums } from "@/lib/database.types";

export type ScheduleMode = Enums<"schedule_mode">;
export type IntervalUnit = Enums<"interval_unit">;
export type ShortMonthBehavior = Enums<"short_month_behavior">;

export type GeneratedScheduleRule = {
  mode: Extract<ScheduleMode, "ongoing" | "finite">;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  anchorDate: string;
  anchorDay: number | null;
  shortMonthBehavior: ShortMonthBehavior | null;
  endsOn: string | null;
  occurrenceCount: number | null;
};

export type ManualScheduleRule = {
  mode: "manual";
  occurrences: Array<{
    dueDate: string;
    amountStatus: Enums<"amount_status">;
    expectedAmountMinor: number | null;
  }>;
};
