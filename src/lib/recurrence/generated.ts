import type {
  BusinessDayAdjustment,
  IntervalUnit,
  ScheduleMode,
  ShortMonthBehavior
} from "./types";

export type ScheduleBasis = "date" | "weekday" | "month_weekday";

export type GeneratedDueDateInput = {
  anchorDate: string;
  count: number;
  intervalCount?: number;
  intervalUnit: Extract<IntervalUnit, "day" | "week" | "month" | "year">;
  ordinalWeek?: number | null;
  businessDayAdjustment?: BusinessDayAdjustment;
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
  businessDayAdjustment = "none",
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
    return generateDayIntervalDates({
      businessDayAdjustment,
      count,
      intervalDays: intervalCount * 7,
      startDate: firstDate
    });
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
      businessDayAdjustment,
      count,
      intervalCount,
      ordinalWeek,
      weekday
    });
  }

  if (intervalUnit === "day") {
    return generateDayIntervalDates({
      businessDayAdjustment,
      count,
      intervalDays: intervalCount,
      startDate: anchor.date
    });
  }

  if (intervalUnit === "week") {
    return generateDayIntervalDates({
      businessDayAdjustment,
      count,
      intervalDays: intervalCount * 7,
      startDate: anchor.date
    });
  }

  if (intervalUnit === "year") {
    return generateYearlyDates({
      anchorDate: anchor.date,
      businessDayAdjustment,
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
      pushAdjustedDate(dates, candidate, businessDayAdjustment);
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
  businessDayAdjustment,
  count,
  intervalCount,
  shortMonthBehavior
}: {
  anchorDate: Date;
  businessDayAdjustment: BusinessDayAdjustment;
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
      pushAdjustedDate(dates, candidate, businessDayAdjustment);
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
  businessDayAdjustment,
  count,
  intervalCount,
  ordinalWeek,
  weekday
}: {
  anchorDate: Date;
  businessDayAdjustment: BusinessDayAdjustment;
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
      pushAdjustedDate(dates, candidate, businessDayAdjustment);
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

function generateDayIntervalDates({
  businessDayAdjustment,
  count,
  intervalDays,
  startDate
}: {
  businessDayAdjustment: BusinessDayAdjustment;
  count: number;
  intervalDays: number;
  startDate: Date;
}) {
  const dates: string[] = [];
  let offset = 0;

  while (dates.length < count) {
    const candidate = addDays(startDate, offset * intervalDays);
    pushAdjustedDate(dates, candidate, businessDayAdjustment);
    offset += 1;
  }

  return dates;
}

function pushAdjustedDate(
  dates: string[],
  candidate: Date,
  businessDayAdjustment: BusinessDayAdjustment
) {
  const adjustedDate = formatDateOnly(
    adjustBusinessDay(candidate, businessDayAdjustment)
  );

  if (!dates.includes(adjustedDate)) {
    dates.push(adjustedDate);
  }
}

function adjustBusinessDay(date: Date, businessDayAdjustment: BusinessDayAdjustment) {
  if (businessDayAdjustment === "none") {
    return date;
  }

  const step = businessDayAdjustment === "previous_business_day" ? -1 : 1;
  let adjustedDate = date;

  while (isWeekend(adjustedDate) || isObservedFederalHoliday(adjustedDate)) {
    adjustedDate = addDays(adjustedDate, step);
  }

  return adjustedDate;
}

function isWeekend(date: Date) {
  return date.getUTCDay() === 0 || date.getUTCDay() === 6;
}

function isObservedFederalHoliday(date: Date) {
  const year = date.getUTCFullYear();
  const dateOnly = formatDateOnly(date);
  return (
    federalHolidaysForYear(year).has(dateOnly) ||
    federalHolidaysForYear(year + 1).has(dateOnly)
  );
}

function federalHolidaysForYear(year: number) {
  const holidays = new Set<string>();
  const addObservedFixed = (month: number, day: number) => {
    const date = new Date(Date.UTC(year, month - 1, day));

    if (date.getUTCDay() === 6) {
      holidays.add(formatDateOnly(addDays(date, -1)));
      return;
    }

    if (date.getUTCDay() === 0) {
      holidays.add(formatDateOnly(addDays(date, 1)));
      return;
    }

    holidays.add(formatDateOnly(date));
  };

  addObservedFixed(1, 1);
  holidays.add(formatDateOnly(nthWeekdayOfMonth(year, 1, 1, 3)));
  holidays.add(formatDateOnly(nthWeekdayOfMonth(year, 2, 1, 3)));
  holidays.add(formatDateOnly(lastWeekdayOfMonth(year, 5, 1)));
  addObservedFixed(6, 19);
  addObservedFixed(7, 4);
  holidays.add(formatDateOnly(nthWeekdayOfMonth(year, 9, 1, 1)));
  holidays.add(formatDateOnly(nthWeekdayOfMonth(year, 10, 1, 2)));
  addObservedFixed(11, 11);
  holidays.add(formatDateOnly(nthWeekdayOfMonth(year, 11, 4, 4)));
  addObservedFixed(12, 25);

  return holidays;
}

function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  ordinalWeek: number
) {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysForward = (weekday - firstDay.getUTCDay() + 7) % 7;
  return addDays(firstDay, daysForward + (ordinalWeek - 1) * 7);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number) {
  const lastDay = new Date(Date.UTC(year, month, 0));
  const daysBack = (lastDay.getUTCDay() - weekday + 7) % 7;
  return addDays(lastDay, -daysBack);
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
