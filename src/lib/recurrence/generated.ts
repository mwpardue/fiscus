import type { IntervalUnit, ScheduleMode, ShortMonthBehavior } from "./types";

export type ScheduleBasis = "date" | "weekday" | "month_weekday";

export type GeneratedDueDateInput = {
  anchorDate: string;
  count: number;
  intervalCount?: number;
  intervalUnit: Extract<IntervalUnit, "day" | "week" | "month" | "year">;
  ordinalWeek?: number | null;
  scheduleBasis?: ScheduleBasis;
  shortMonthBehavior?: ShortMonthBehavior;
  weekday?: number | null;
};

export type GeneratedScheduleInput = GeneratedDueDateInput & {
  mode: Extract<ScheduleMode, "ongoing" | "finite">;
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function generateDueDates({
  anchorDate,
  count,
  intervalCount = 1,
  intervalUnit,
  ordinalWeek = null,
  scheduleBasis = "date",
  shortMonthBehavior = "last_day",
  weekday = null
}: GeneratedDueDateInput) {
  const anchor = parseDateOnly(anchorDate);

  if (!anchor || count < 1 || intervalCount < 1) {
    return [];
  }

  if (scheduleBasis === "weekday") {
    if (intervalUnit !== "week" || !isValidWeekday(weekday)) {
      return [];
    }

    const firstDate = firstWeekdayOnOrAfter(anchor.date, weekday);
    return Array.from({ length: count }, (_, index) =>
      formatDateOnly(addDays(firstDate, index * intervalCount * 7))
    );
  }

  if (scheduleBasis === "month_weekday") {
    if (
      intervalUnit !== "month" ||
      !isValidWeekday(weekday) ||
      !isValidOrdinalWeek(ordinalWeek)
    ) {
      return [];
    }

    return generateMonthlyWeekdayDates({
      anchorDate: anchor.date,
      count,
      intervalCount,
      ordinalWeek,
      weekday
    });
  }

  if (intervalUnit === "day") {
    return Array.from({ length: count }, (_, index) =>
      formatDateOnly(addDays(anchor.date, index * intervalCount))
    );
  }

  if (intervalUnit === "week") {
    return Array.from({ length: count }, (_, index) =>
      formatDateOnly(addDays(anchor.date, index * intervalCount * 7))
    );
  }

  if (intervalUnit === "year") {
    return generateYearlyDates({
      anchorDate: anchor.date,
      count,
      intervalCount,
      shortMonthBehavior
    });
  }

  const dates: string[] = [];
  let offset = 0;

  while (dates.length < count) {
    const monthIndex = anchor.monthIndex + offset * intervalCount;
    const candidate = resolveMonthlyDate(
      anchor.year,
      monthIndex,
      anchor.day,
      shortMonthBehavior
    );

    if (candidate) {
      dates.push(formatDateOnly(candidate));
    }

    offset += 1;
  }

  return dates;
}

export function describeGeneratedSchedule({
  intervalCount = 1,
  intervalUnit,
  mode,
  ordinalWeek = null,
  scheduleBasis = "date",
  weekday = null
}: Pick<GeneratedScheduleInput, "intervalCount" | "intervalUnit" | "mode"> &
  Pick<GeneratedDueDateInput, "ordinalWeek" | "scheduleBasis" | "weekday">) {
  if (scheduleBasis === "weekday" && isValidWeekday(weekday)) {
    const cadence =
      intervalCount === 1
        ? `every ${WEEKDAYS[weekday]}`
        : intervalCount === 2
          ? `every other ${WEEKDAYS[weekday]}`
          : `every ${intervalCount} weeks on ${WEEKDAYS[weekday]}`;
    return mode === "finite" ? `Repeats ${cadence}` : `Repeats ${cadence} without an end date`;
  }

  if (
    scheduleBasis === "month_weekday" &&
    isValidWeekday(weekday) &&
    isValidOrdinalWeek(ordinalWeek)
  ) {
    const cadence =
      intervalCount === 1
        ? `every ${ordinalWeekLabel(ordinalWeek)} ${WEEKDAYS[weekday]} of the month`
        : `every ${intervalCount} months on the ${ordinalWeekLabel(ordinalWeek)} ${WEEKDAYS[weekday]}`;
    return mode === "finite" ? `Repeats ${cadence}` : `Repeats ${cadence} without an end date`;
  }

  const unit = intervalCount === 1 ? intervalUnit : `${intervalUnit}s`;
  const cadence = intervalCount === 1 ? `every ${unit}` : `every ${intervalCount} ${unit}`;

  return mode === "finite" ? `Repeats ${cadence}` : `Repeats ${cadence} without an end date`;
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

function parseDateOnly(value: string) {
  const match = DATE_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const maxDay = daysInMonth(year, month);

  if (month < 1 || month > 12 || day < 1 || day > maxDay) {
    return null;
  }

  return {
    date: new Date(Date.UTC(year, month - 1, day)),
    day,
    month,
    monthIndex: month - 1,
    year
  };
}

function resolveMonthlyDate(
  anchorYear: number,
  monthIndex: number,
  anchorDay: number,
  shortMonthBehavior: ShortMonthBehavior
) {
  const year = anchorYear + Math.floor(monthIndex / 12);
  const month = modulo(monthIndex, 12) + 1;
  const maxDay = daysInMonth(year, month);

  if (anchorDay <= maxDay) {
    return new Date(Date.UTC(year, month - 1, anchorDay));
  }

  if (shortMonthBehavior === "skip") {
    return null;
  }

  if (shortMonthBehavior === "next_month") {
    return addDays(new Date(Date.UTC(year, month - 1, maxDay)), anchorDay - maxDay);
  }

  return new Date(Date.UTC(year, month - 1, maxDay));
}

function generateYearlyDates({
  anchorDate,
  count,
  intervalCount,
  shortMonthBehavior
}: {
  anchorDate: Date;
  count: number;
  intervalCount: number;
  shortMonthBehavior: ShortMonthBehavior;
}) {
  const dates: string[] = [];
  let offset = 0;
  const anchorYear = anchorDate.getUTCFullYear();
  const anchorMonth = anchorDate.getUTCMonth() + 1;
  const anchorDay = anchorDate.getUTCDate();

  while (dates.length < count) {
    const candidate = resolveYearlyDate(
      anchorYear + offset * intervalCount,
      anchorMonth,
      anchorDay,
      shortMonthBehavior
    );

    if (candidate) {
      dates.push(formatDateOnly(candidate));
    }

    offset += 1;
  }

  return dates;
}

function resolveYearlyDate(
  year: number,
  anchorMonth: number,
  anchorDay: number,
  shortMonthBehavior: ShortMonthBehavior
) {
  const maxDay = daysInMonth(year, anchorMonth);

  if (anchorDay <= maxDay) {
    return new Date(Date.UTC(year, anchorMonth - 1, anchorDay));
  }

  if (shortMonthBehavior === "skip") {
    return null;
  }

  if (shortMonthBehavior === "next_month") {
    return addDays(new Date(Date.UTC(year, anchorMonth - 1, maxDay)), anchorDay - maxDay);
  }

  return new Date(Date.UTC(year, anchorMonth - 1, maxDay));
}

function generateMonthlyWeekdayDates({
  anchorDate,
  count,
  intervalCount,
  ordinalWeek,
  weekday
}: {
  anchorDate: Date;
  count: number;
  intervalCount: number;
  ordinalWeek: number;
  weekday: number;
}) {
  const dates: string[] = [];
  let monthOffset = 0;

  while (dates.length < count) {
    const candidateMonth = new Date(
      Date.UTC(
        anchorDate.getUTCFullYear(),
        anchorDate.getUTCMonth() + monthOffset,
        1
      )
    );
    const candidate = weekdayOfMonth(candidateMonth, ordinalWeek, weekday);

    if (candidate >= anchorDate) {
      dates.push(formatDateOnly(candidate));
    }

    monthOffset += intervalCount;
  }

  return dates;
}

function weekdayOfMonth(monthDate: Date, ordinalWeek: number, weekday: number) {
  if (ordinalWeek === -1) {
    const lastDay = new Date(
      Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)
    );
    const daysBack = (lastDay.getUTCDay() - weekday + 7) % 7;
    return addDays(lastDay, -daysBack);
  }

  const firstDay = new Date(
    Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1)
  );
  const daysForward = (weekday - firstDay.getUTCDay() + 7) % 7;
  return addDays(firstDay, daysForward + (ordinalWeek - 1) * 7);
}

function firstWeekdayOnOrAfter(date: Date, weekday: number) {
  return addDays(date, (weekday - date.getUTCDay() + 7) % 7);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDateOnly(date: Date) {
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}

function isValidWeekday(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6;
}

function isValidOrdinalWeek(value: number | null | undefined): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    (value === -1 || (value >= 1 && value <= 4))
  );
}

function ordinalWeekLabel(value: number) {
  if (value === -1) {
    return "last";
  }

  return ["first", "second", "third", "fourth"][value - 1] ?? String(value);
}

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}
