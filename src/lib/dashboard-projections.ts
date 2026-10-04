import type { DashboardOccurrence } from "./occurrences";

export function buildWeeklyOccurrenceGroups(
  occurrences: DashboardOccurrence[],
  projectionOccurrences: DashboardOccurrence[],
  weekStartsOn: number,
  startingBalanceMinor: number | null,
  selectedDay: string | null
) {
  const grouped = new Map<
    string,
    {
      occurrences: DashboardOccurrence[];
      projectedDeltaMinor: number;
      weekEnd: string;
      weekStart: string;
    }
  >();

  for (const occurrence of occurrences) {
    const weekStart = getWeekStartDate(occurrence.due_date, weekStartsOn);
    const weekEnd = formatDateOnly(addUtcDays(parseDateOnly(weekStart), 6));
    const group = grouped.get(weekStart) ?? {
      occurrences: [],
      projectedDeltaMinor: 0,
      weekEnd,
      weekStart
    };

    group.occurrences.push(occurrence);
    group.projectedDeltaMinor += getProjectedOccurrenceDelta(occurrence);
    grouped.set(weekStart, group);
  }

  if (selectedDay && grouped.size === 0) {
    const weekStart = getWeekStartDate(selectedDay, weekStartsOn);
    grouped.set(weekStart, {
      occurrences: [],
      projectedDeltaMinor: 0,
      weekEnd: formatDateOnly(addUtcDays(parseDateOnly(weekStart), 6)),
      weekStart
    });
  }

  let runningProjectionMinor = startingBalanceMinor;
  let projectionIndex = 0;
  const sortedProjectionOccurrences = [...projectionOccurrences].sort(
    (first, second) => first.due_date.localeCompare(second.due_date)
  );

  return Array.from(grouped.values())
    .sort((first, second) => first.weekStart.localeCompare(second.weekStart))
    .map((group) => {
      const balanceTargetDate = selectedDay ?? group.weekEnd;

      while (
        runningProjectionMinor !== null &&
        projectionIndex < sortedProjectionOccurrences.length &&
        sortedProjectionOccurrences[projectionIndex]!.due_date <=
          balanceTargetDate
      ) {
        runningProjectionMinor += getProjectedOccurrenceDelta(
          sortedProjectionOccurrences[projectionIndex]!
        );
        projectionIndex += 1;
      }

      return {
        ...group,
        endingBalanceMinor: runningProjectionMinor
      };
    });
}

export function getProjectedOccurrenceDelta(occurrence: DashboardOccurrence) {
  if (
    occurrence.lifecycle_status !== "upcoming" ||
    occurrence.amount_status === "unknown" ||
    occurrence.expected_amount_minor === null
  ) {
    return 0;
  }

  return occurrence.financial_items?.kind === "income"
    ? occurrence.expected_amount_minor
    : -occurrence.expected_amount_minor;
}

function getWeekStartDate(date: string, weekStartsOn: number) {
  const parsedDate = parseDateOnly(date);
  const normalizedWeekStart = Math.min(Math.max(weekStartsOn, 0), 6);
  const distanceFromWeekStart =
    (parsedDate.getUTCDay() - normalizedWeekStart + 7) % 7;

  return formatDateOnly(addUtcDays(parsedDate, -distanceFromWeekStart));
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function parseDateOnly(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(date: Date) {
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}
