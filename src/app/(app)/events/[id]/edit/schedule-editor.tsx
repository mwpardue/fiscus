"use client";

import { useMemo, useState } from "react";
import {
  describeGeneratedSchedule,
  generateDueDates,
  type ScheduleBasis
} from "@/lib/recurrence/generated";
import { updateGeneratedScheduleAction } from "../../actions";

type Rule = {
  anchor_date: string | null;
  anchor_weekday: number | null;
  business_day_adjustment:
    | "none"
    | "previous_business_day"
    | "next_business_day";
  id: string;
  interval_count: number | null;
  interval_unit: "day" | "week" | "month" | "year" | null;
  mode: string;
  occurrence_count: number | null;
  ordinal_week: number | null;
  schedule_basis: string;
  short_month_behavior: "last_day" | "next_month" | "skip" | null;
};

export function ScheduleEditor({
  eventId,
  returnTo,
  rule
}: {
  eventId: string;
  returnTo?: string;
  rule: Rule;
}) {
  const initialBasis = normalizeScheduleBasis(rule.schedule_basis);
  const [scheduleMode, setScheduleMode] = useState<"ongoing" | "finite">(
    rule.mode === "finite" ? "finite" : "ongoing"
  );
  const [recurrenceType, setRecurrenceType] = useState<"date" | "day">(
    initialBasis === "date" ? "date" : "day"
  );
  const [scheduleBasis, setScheduleBasis] =
    useState<ScheduleBasis>(initialBasis);
  const [dayPattern, setDayPattern] = useState<"weekly" | "monthly">(
    initialBasis === "month_weekday" ? "monthly" : "weekly"
  );
  const [intervalUnit, setIntervalUnit] = useState<
    "day" | "week" | "month" | "year"
  >(rule.interval_unit ?? (initialBasis === "date" ? "month" : "week"));
  const [intervalCount, setIntervalCount] = useState(
    String(rule.interval_count ?? 1)
  );
  const [occurrenceCount, setOccurrenceCount] = useState(
    String(rule.occurrence_count ?? 12)
  );
  const [anchorDate, setAnchorDate] = useState(
    rule.anchor_date ?? getNextDayDate()
  );
  const [weekday, setWeekday] = useState(String(rule.anchor_weekday ?? 5));
  const [ordinalWeek, setOrdinalWeek] = useState(
    String(rule.ordinal_week ?? -1)
  );
  const [shortMonthBehavior, setShortMonthBehavior] = useState<
    "last_day" | "next_month" | "skip"
  >(rule.short_month_behavior ?? "last_day");
  const [businessDayAdjustment, setBusinessDayAdjustment] = useState<
    "none" | "previous_business_day" | "next_business_day"
  >(rule.business_day_adjustment ?? "none");
  const previewCount =
    scheduleMode === "finite" ? Number(occurrenceCount) || 0 : 12;
  const previewDates = useMemo(() => {
    return generateDueDates({
      anchorDate,
      businessDayAdjustment,
      count: previewCount,
      intervalCount: Number(intervalCount) || 0,
      intervalUnit,
      ordinalWeek: Number(ordinalWeek),
      scheduleBasis,
      shortMonthBehavior,
      weekday: Number(weekday)
    });
  }, [
    anchorDate,
    businessDayAdjustment,
    intervalCount,
    intervalUnit,
    occurrenceCount,
    ordinalWeek,
    previewCount,
    scheduleBasis,
    scheduleMode,
    shortMonthBehavior,
    weekday
  ]);
  const scheduleDescription = describeGeneratedSchedule({
    intervalCount: Number(intervalCount) || 1,
    intervalUnit,
    mode: scheduleMode,
    ordinalWeek: Number(ordinalWeek),
    scheduleBasis,
    weekday: Number(weekday)
  });

  return (
    <form
      action={updateGeneratedScheduleAction}
      className="grid gap-4 rounded border border-line bg-paper p-4"
    >
      <input name="eventId" type="hidden" value={eventId} />
      <input name="returnTo" type="hidden" value={returnTo ?? ""} />
      <input name="ruleId" type="hidden" value={rule.id} />

      <fieldset className="grid gap-3">
        <legend className="sr-only">Schedule</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex min-h-12 items-center rounded border border-line bg-white px-3 text-sm font-medium">
            <input
              checked={scheduleMode === "ongoing"}
              className="mr-2"
              name="scheduleMode"
              onChange={() => setScheduleMode("ongoing")}
              type="radio"
              value="ongoing"
            />
            Ongoing
          </label>
          <label className="flex min-h-12 items-center rounded border border-line bg-white px-3 text-sm font-medium">
            <input
              checked={scheduleMode === "finite"}
              className="mr-2"
              name="scheduleMode"
              onChange={() => setScheduleMode("finite")}
              type="radio"
              value="finite"
            />
            Finite
          </label>
        </div>
      </fieldset>

      {scheduleMode === "finite" ? (
        <label className="grid gap-2 text-sm font-medium text-ink">
          Events
          <input
            className="min-h-12 rounded border border-line bg-white px-3 text-base disabled:bg-paper disabled:text-gray-600"
            max={120}
            min={1}
            name="occurrenceCount"
            onChange={(event) => setOccurrenceCount(event.target.value)}
            required={scheduleMode === "finite"}
            type="number"
            value={occurrenceCount}
          />
        </label>
      ) : null}

      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-3 sm:items-start">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Recurrence type
            <select
              className="min-h-12 rounded border border-line bg-white px-3 text-base"
              onChange={(event) => {
                const nextType = event.target.value as "date" | "day";
                setRecurrenceType(nextType);
                if (nextType === "date") {
                  setScheduleBasis("date");
                  setIntervalUnit("month");
                } else {
                  const nextBasis =
                    dayPattern === "weekly" ? "weekday" : "month_weekday";
                  setScheduleBasis(nextBasis);
                  setIntervalUnit(dayPattern === "weekly" ? "week" : "month");
                }
              }}
              value={recurrenceType}
            >
              <option value="date">Date</option>
              <option value="day">Day</option>
            </select>
          </label>

          <input name="scheduleBasis" type="hidden" value={scheduleBasis} />

          {recurrenceType === "day" ? (
            <label className="grid gap-2 text-sm font-medium text-ink">
              Day pattern
              <select
                className="min-h-12 rounded border border-line bg-white px-3 text-base"
                onChange={(event) => {
                  const nextPattern = event.target.value as
                    | "weekly"
                    | "monthly";
                  setDayPattern(nextPattern);
                  setScheduleBasis(
                    nextPattern === "weekly" ? "weekday" : "month_weekday"
                  );
                  setIntervalUnit(nextPattern === "weekly" ? "week" : "month");
                }}
                value={dayPattern}
              >
                <option value="weekly">Every N weeks</option>
                <option value="monthly">Week of month</option>
              </select>
            </label>
          ) : null}

          <label className="grid gap-2 text-sm font-medium text-ink">
            Every
            <input
              className="min-h-12 rounded border border-line bg-white px-3 text-base"
              max={24}
              min={1}
              name="intervalCount"
              onChange={(event) => setIntervalCount(event.target.value)}
              required
              type="number"
              value={intervalCount}
            />
            {recurrenceType === "day" ? (
              <span className="text-xs text-gray-700">
                {dayPattern === "weekly" ? "weeks" : "months"}
              </span>
            ) : null}
          </label>

          {recurrenceType === "date" ? (
            <label className="grid gap-2 text-sm font-medium text-ink">
              Unit
              <select
                className="min-h-12 rounded border border-line bg-white px-3 text-base"
                name="intervalUnit"
                onChange={(event) =>
                  setIntervalUnit(
                    event.target.value as "day" | "week" | "month" | "year"
                  )
                }
                value={intervalUnit}
              >
                <option value="day">Days</option>
                <option value="week">Weeks</option>
                <option value="month">Months</option>
                <option value="year">Years</option>
              </select>
            </label>
          ) : null}
        </div>

        <details className="grid gap-3 text-sm text-ink">
          <summary className="w-fit cursor-pointer rounded border border-line bg-white px-3 py-2 text-sm font-semibold">
            Recurrence Options
          </summary>
          <div className="mt-3 grid gap-4 rounded border border-line bg-paper p-3 sm:grid-cols-2">
            {recurrenceType === "date" &&
            (intervalUnit === "month" || intervalUnit === "year") ? (
              <label className="grid gap-2 text-sm font-medium text-ink">
                Short-month behavior
                <select
                  className="min-h-12 rounded border border-line bg-white px-3 text-base"
                  name="shortMonthBehavior"
                  onChange={(event) =>
                    setShortMonthBehavior(
                      event.target.value as "last_day" | "next_month" | "skip"
                    )
                  }
                  value={shortMonthBehavior}
                >
                  <option value="last_day">Use final day</option>
                  <option value="next_month">Roll into next month</option>
                  <option value="skip">Skip that month</option>
                </select>
              </label>
            ) : (
              <input
                name="shortMonthBehavior"
                type="hidden"
                value={shortMonthBehavior}
              />
            )}
            <label className="grid gap-2 text-sm font-medium text-ink">
              Weekend or holiday
              <select
                className="min-h-12 rounded border border-line bg-white px-3 text-base"
                name="businessDayAdjustment"
                onChange={(event) =>
                  setBusinessDayAdjustment(
                    event.target.value as
                      | "none"
                      | "previous_business_day"
                      | "next_business_day"
                  )
                }
                value={businessDayAdjustment}
              >
                <option value="none">No adjustment</option>
                <option value="previous_business_day">
                  Move to previous business day
                </option>
                <option value="next_business_day">
                  Move to next business day
                </option>
              </select>
            </label>
          </div>
        </details>
      </div>

      {recurrenceType === "day" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="intervalUnit" type="hidden" value={intervalUnit} />

          {dayPattern === "monthly" ? (
            <label className="grid gap-2 text-sm font-medium text-ink">
              Week
              <select
                className="min-h-12 rounded border border-line bg-white px-3 text-base"
                name="ordinalWeek"
                onChange={(event) => setOrdinalWeek(event.target.value)}
                value={ordinalWeek}
              >
                <option value="1">First</option>
                <option value="2">Second</option>
                <option value="3">Third</option>
                <option value="4">Fourth</option>
                <option value="-1">Last</option>
              </select>
            </label>
          ) : (
            <input name="ordinalWeek" type="hidden" value={ordinalWeek} />
          )}

          {dayPattern === "weekly" ? (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-semibold text-ink">Weekdays</legend>
              <div className="grid grid-cols-7 gap-1 rounded-full border border-line bg-paper p-1">
                {WEEKDAY_OPTIONS.map((option) => {
                  const selected = weekday === option.value;

                  return (
                    <label className="relative cursor-pointer" key={option.value}>
                      <input
                        checked={selected}
                        className="sr-only"
                        name="weekday"
                        onChange={() => setWeekday(option.value)}
                        type="radio"
                        value={option.value}
                      />
                      <span
                        className={
                          selected
                            ? "flex aspect-square min-h-10 items-center justify-center rounded-full border-2 border-mint bg-mint text-sm font-semibold text-white shadow-sm ring-2 ring-mint/30"
                            : "flex aspect-square min-h-10 items-center justify-center rounded-full border border-transparent bg-white text-sm font-semibold text-gray-700"
                        }
                      >
                        {option.shortLabel}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <label className="grid gap-2 text-sm font-medium text-ink">
              Weekday
              <select
                className="min-h-12 rounded border border-line bg-white px-3 text-base"
                name="weekday"
                onChange={(event) => setWeekday(event.target.value)}
                value={weekday}
              >
                {WEEKDAY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      ) : (
        <>
          <input name="weekday" type="hidden" value={weekday} />
          <input name="ordinalWeek" type="hidden" value={ordinalWeek} />
        </>
      )}

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold text-ink">Dates</h2>
        <label className="grid gap-2 text-sm font-medium text-ink">
          First due date
          <input
            className="min-h-12 rounded border border-line bg-white px-3 text-base"
            name="anchorDate"
            onChange={(event) => {
              setAnchorDate(event.target.value);
            }}
            required
            type="date"
            value={anchorDate}
          />
        </label>
      </section>

      {scheduleMode === "finite" ? (
        <section className="grid gap-3 rounded border border-line bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Preview</h2>
            <p className="text-xs font-medium text-gray-700">
              {previewDates.length} dates
            </p>
          </div>
          <p className="text-sm text-gray-700">{scheduleDescription}</p>
          {previewDates.length > 0 ? (
            <ol className="grid max-h-56 gap-2 overflow-auto text-sm text-ink sm:grid-cols-2">
              {previewDates.map((date) => (
                <li
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded border border-line bg-white px-3 py-2"
                  key={date}
                >
                  <span className="rounded border border-line bg-paper px-2 py-1 text-xs font-semibold text-ink">
                    {formatWeekday(date)}
                  </span>
                  <span className="font-semibold">{formatDisplayDate(date)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded border border-line bg-white px-3 py-2 text-sm text-gray-700">
              Enter a first due date to preview the generated schedule.
            </p>
          )}
        </section>
      ) : null}

      <button className="min-h-12 rounded bg-mint px-4 font-semibold text-white">
        Save schedule
      </button>
    </form>
  );
}

const WEEKDAY_OPTIONS = [
  { label: "Sun", shortLabel: "S", value: "0" },
  { label: "Mon", shortLabel: "M", value: "1" },
  { label: "Tue", shortLabel: "T", value: "2" },
  { label: "Wed", shortLabel: "W", value: "3" },
  { label: "Thu", shortLabel: "T", value: "4" },
  { label: "Fri", shortLabel: "F", value: "5" },
  { label: "Sat", shortLabel: "S", value: "6" }
];

function normalizeScheduleBasis(value: string): ScheduleBasis {
  return value === "weekday" || value === "month_weekday" ? value : "date";
}

function getNextDayDate() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return formatLocalDate(date);
}

function formatDisplayDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  }).format(parseDateOnly(date));
}

function formatWeekday(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short"
  }).format(parseDateOnly(date));
}

function parseDateOnly(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatLocalDate(date: Date) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}
