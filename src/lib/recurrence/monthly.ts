import type { ShortMonthBehavior } from "./types";
import { generateDueDates } from "./generated";

export type MonthlyOccurrenceInput = {
  anchorDate: string;
  intervalCount?: number;
  shortMonthBehavior?: ShortMonthBehavior;
  count?: number;
};

export function generateMonthlyDueDates(input: MonthlyOccurrenceInput) {
  return generateDueDates({
    ...input,
    count: input.count ?? 12,
    intervalUnit: "month"
  });
}
