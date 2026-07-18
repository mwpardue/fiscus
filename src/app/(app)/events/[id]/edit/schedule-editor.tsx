"use client";

import { useMemo, useState } from "react";
import {
  describeGeneratedSchedule,
  generateDueDates,
  type ScheduleBasis
} from "@/lib/recurrence/generated";
import {
  ChoiceButton,
  DatePreviewList,
  dateFieldControlClass,
  fieldControlClass,
  primaryActionClass
} from "@/app/(app)/entries/event-form-ui";
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
  defaultAmount,
  defaultAmountStatus,
  eventId,
  returnTo,
  rule
}: {
  defaultAmount: string;
  defaultAmountStatus: "fixed" | "estimated" | "unknown";
  eventId: string;
  returnTo?: string;
  rule: Rule;
}) {
  const initialBasis = normalizeScheduleBasis(rule.schedule_basis);
  const [scheduleMode, setScheduleMode] = useState<
    "ongoing" | "finite" | "manual"
  >(
    rule.mode === "finite" ? "finite" : "ongoing"
  );
  const [recurrenceType, setRecurrenceType] = useState<
    "date" | "day" | "manual"
  >(
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
  const [selectedWeekdays, setSelectedWeekdays] = useState([
    String(rule.anchor_weekday ?? 5)
  ]);
  const [manualRows, setManualRows] = useState([
    {
      amount: defaultAmount,
      amountStatus: defaultAmountStatus,
      date: rule.anchor_date ?? getNextDayDate()
    }
  ]);
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
    if (scheduleMode === "manual") {
      return Array.from(
        new Set(manualRows.map((row) => row.date).filter(Boolean))
      ).sort();
    }

    if (scheduleBasis === "weekday") {
      return Array.from(
        new Set(
          selectedWeekdays.flatMap((selectedWeekday) =>
            generateDueDates({
              anchorDate,
              businessDayAdjustment,
              count: previewCount,
              intervalCount: Number(intervalCount) || 0,
              intervalUnit,
              ordinalWeek: Number(ordinalWeek),
              scheduleBasis,
              shortMonthBehavior,
              weekday: Number(selectedWeekday)
            })
          )
        )
      ).sort();
    }

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
    manualRows,
    occurrenceCount,
    ordinalWeek,
    previewCount,
    selectedWeekdays,
    scheduleBasis,
    scheduleMode,
    shortMonthBehavior,
    weekday
  ]);
  const scheduleDescription =
    scheduleMode === "manual"
      ? "Uses the due dates entered below"
      : scheduleBasis === "weekday" && selectedWeekdays.length > 1
        ? `Repeats across ${selectedWeekdays.length} weekdays`
        : describeGeneratedSchedule({
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
      className="grid min-w-0 gap-3 rounded border border-line bg-white p-3 sm:gap-4 sm:p-4"
    >
      <input name="eventId" type="hidden" value={eventId} />
      <input name="returnTo" type="hidden" value={returnTo ?? ""} />
      <input name="ruleId" type="hidden" value={rule.id} />
      <input name="scheduleMode" type="hidden" value={scheduleMode} />

      <div className="grid grid-cols-2 gap-2">
        <ChoiceButton
          active={scheduleMode === "ongoing"}
          onClick={() => {
            setScheduleMode("ongoing");
            if (recurrenceType === "manual") {
              setRecurrenceType("date");
            }
          }}
        >
          Ongoing
        </ChoiceButton>
        <ChoiceButton
          active={scheduleMode !== "ongoing"}
          onClick={() => {
            setScheduleMode("finite");
            if (recurrenceType === "manual") {
              setRecurrenceType("date");
            }
          }}
        >
          Finite
        </ChoiceButton>
      </div>

      {scheduleMode === "finite" ? (
        <label className="grid gap-2 text-sm font-medium text-ink">
          Events
          <input
            className={`${fieldControlClass} disabled:bg-paper disabled:text-gray-600`}
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
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-start gap-2 sm:gap-4">
          <label className="grid min-w-0 gap-2 text-xs font-medium text-ink sm:text-sm">
            Recurrence type
            <select
              className={fieldControlClass}
              onChange={(event) => {
                const nextType = event.target.value as
                  | "date"
                  | "day"
                  | "manual";
                setRecurrenceType(nextType);
                if (nextType === "date") {
                  if (scheduleMode === "manual") {
                    setScheduleMode("finite");
                  }
                  setScheduleBasis("date");
                  setIntervalUnit("month");
                } else if (nextType === "day") {
                  if (scheduleMode === "manual") {
                    setScheduleMode("finite");
                  }
                  const nextBasis =
                    dayPattern === "weekly" ? "weekday" : "month_weekday";
                  setScheduleBasis(nextBasis);
                  setIntervalUnit(dayPattern === "weekly" ? "week" : "month");
                } else {
                  setScheduleMode("manual");
                }
              }}
              value={recurrenceType}
            >
              <option value="date">Date</option>
              <option value="day">Day</option>
              {scheduleMode !== "ongoing" ? (
                <option value="manual">Manual</option>
              ) : null}
            </select>
          </label>

          <input name="scheduleBasis" type="hidden" value={scheduleBasis} />

          {scheduleMode !== "manual" && recurrenceType === "day" ? (
            <label className="grid min-w-0 gap-2 text-xs font-medium text-ink sm:text-sm">
              Day pattern
              <select
                className={fieldControlClass}
                onChange={(event) => {
                  const nextPattern = event.target.value as
                    | "weekly"
                    | "monthly";
                  setDayPattern(nextPattern);
                  setScheduleBasis(
                    nextPattern === "weekly" ? "weekday" : "month_weekday"
                  );
                  setIntervalUnit(nextPattern === "weekly" ? "week" : "month");
                  if (nextPattern === "weekly") {
                    setAnchorDate(
                      formatLocalDate(
                        earliestSelectedWeekdayInAnchorWeek(
                          parseLocalDate(anchorDate),
                          selectedWeekdays,
                          Number(weekday)
                        )
                      )
                    );
                  }
                }}
                value={dayPattern}
              >
                <option value="weekly">Every N weeks</option>
                <option value="monthly">Week of month</option>
              </select>
            </label>
          ) : null}

          {scheduleMode !== "manual" ? (
            <label className="grid min-w-0 gap-2 text-xs font-medium text-ink sm:text-sm">
              Every
              <input
                className={fieldControlClass}
                max={24}
                min={1}
                name="intervalCount"
                onChange={(event) => setIntervalCount(event.target.value)}
                required
                type="number"
                value={intervalCount}
              />
              {recurrenceType === "day" ? (
                <span className="text-[0.6875rem] text-gray-700 sm:text-xs">
                  {dayPattern === "weekly" ? "weeks" : "months"}
                </span>
              ) : null}
            </label>
          ) : null}

          {scheduleMode !== "manual" && recurrenceType === "date" ? (
            <label className="grid min-w-0 gap-2 text-xs font-medium text-ink sm:text-sm">
              Unit
              <select
                className={fieldControlClass}
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

        {scheduleMode !== "manual" ? (
        <details className="grid gap-3 text-sm text-ink">
          <summary className="w-fit cursor-pointer rounded border border-line bg-white px-3 py-2 text-sm font-semibold">
            Recurrence Options
          </summary>
          <div className="mt-3 grid gap-4 rounded border border-line bg-paper p-3 sm:grid-cols-2">
            {recurrenceType === "date" &&
            (intervalUnit === "month" || intervalUnit === "year") ? (
              <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
                Short-month behavior
                <select
                  className={fieldControlClass}
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
            <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
              Weekend or holiday
              <select
                className={fieldControlClass}
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
        ) : null}
      </div>

      {scheduleMode !== "manual" && recurrenceType === "day" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="intervalUnit" type="hidden" value={intervalUnit} />

          {dayPattern === "monthly" ? (
            <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
              Week
              <select
                className={fieldControlClass}
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
                  const selected = selectedWeekdays.includes(option.value);

                  return (
                    <label className="relative cursor-pointer" key={option.value}>
                      <input
                        checked={selected}
                        className="sr-only"
                        name="weekday"
                        onChange={(event) => {
                          const nextWeekdays = event.target.checked
                            ? Array.from(
                                new Set([...selectedWeekdays, option.value])
                              )
                            : selectedWeekdays.filter(
                                (value) => value !== option.value
                              );
                          const safeNextWeekdays =
                            nextWeekdays.length > 0
                              ? nextWeekdays
                              : selectedWeekdays;
                          setSelectedWeekdays((current) => {
                            if (event.target.checked) {
                              return Array.from(
                                new Set([...current, option.value])
                              );
                            }

                            const next = current.filter(
                              (value) => value !== option.value
                            );
                            return next.length > 0 ? next : current;
                          });
                          setWeekday(option.value);
                          setAnchorDate(
                            formatLocalDate(
                              earliestSelectedWeekdayInAnchorWeek(
                                parseLocalDate(anchorDate),
                                safeNextWeekdays,
                                Number(option.value)
                              )
                            )
                          );
                        }}
                        type="checkbox"
                        value={option.value}
                      />
                      <span
                        className={
                          selected
                            ? "flex aspect-square min-h-8 items-center justify-center rounded-full border-2 border-mint bg-mint text-xs font-semibold text-white shadow-sm ring-2 ring-mint/30 sm:min-h-10 sm:text-sm"
                            : "flex aspect-square min-h-8 items-center justify-center rounded-full border border-transparent bg-white text-xs font-semibold text-gray-700 sm:min-h-10 sm:text-sm"
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
            <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
              Weekday
              <select
                className={fieldControlClass}
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

      {scheduleMode === "manual" ? (
        <input
          name="shortMonthBehavior"
          type="hidden"
          value={shortMonthBehavior}
        />
      ) : null}

      {scheduleMode !== "manual" ? (
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold text-ink">Dates</h2>
        <label className="grid gap-2 text-sm font-medium text-ink">
          Starts on
          <input
            className={dateFieldControlClass}
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
      ) : null}

      {scheduleMode === "manual" ? (
        <section className="grid min-w-0 gap-3 rounded border border-line bg-paper p-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Dates</h2>
            <button
              className="min-h-10 rounded border border-line bg-white px-3 text-sm font-semibold"
              type="button"
              onClick={() =>
                setManualRows((rows) => [
                  ...rows,
                  {
                    amount: defaultAmount,
                    amountStatus: defaultAmountStatus,
                    date: getNextDayDate()
                  }
                ])
              }
            >
              Add date
            </button>
          </div>
          <div className="grid gap-3">
            {manualRows.map((row, index) => (
              <div
                className="grid min-w-0 gap-3 overflow-hidden rounded border border-line bg-white p-3 sm:grid-cols-[1fr_10rem_1fr_auto] sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0"
                key={index}
              >
                <label className="sr-only" htmlFor={`manual-date-${index}`}>
                  Manual due date {index + 1}
                </label>
                <input
                  className={dateFieldControlClass}
                  id={`manual-date-${index}`}
                  name="manualDate"
                  type="date"
                  value={row.date}
                  onChange={(event) =>
                    setManualRows((rows) =>
                      rows.map((existingRow, rowIndex) =>
                        rowIndex === index
                          ? { ...existingRow, date: event.target.value }
                          : existingRow
                      )
                    )
                  }
                  required={index === 0}
                />
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:contents">
                  <select
                    className={fieldControlClass}
                    name="manualAmountStatus"
                    value={row.amountStatus}
                    onChange={(event) =>
                      setManualRows((rows) =>
                        rows.map((existingRow, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...existingRow,
                                amountStatus: event.target.value as
                                  | "fixed"
                                  | "estimated"
                                  | "unknown"
                              }
                            : existingRow
                        )
                      )
                    }
                  >
                    <option value="unknown">Unknown</option>
                    <option value="fixed">Fixed</option>
                    <option value="estimated">Estimated</option>
                  </select>
                  <input
                    className={`${fieldControlClass} disabled:bg-paper`}
                    disabled={row.amountStatus === "unknown"}
                    inputMode="decimal"
                    name="manualExpectedAmount"
                    onChange={(event) =>
                      setManualRows((rows) =>
                        rows.map((existingRow, rowIndex) =>
                          rowIndex === index
                            ? { ...existingRow, amount: event.target.value }
                            : existingRow
                        )
                      )
                    }
                    placeholder="Amount"
                    value={row.amount}
                  />
                </div>
                <button
                  className="min-h-11 rounded border border-line bg-white px-3 text-sm font-semibold disabled:opacity-50 sm:min-h-12"
                  disabled={manualRows.length === 1}
                  onClick={() =>
                    setManualRows((rows) =>
                      rows.filter((_, rowIndex) => rowIndex !== index)
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <DatePreviewList dates={previewDates} description={scheduleDescription} />

      <section className="rounded border border-line bg-paper p-3 text-sm leading-6 text-gray-700">
        Paid, received, skipped, and deleted events stay preserved.
      </section>

      <button className={`${primaryActionClass} sm:justify-self-start`}>
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

function earliestSelectedWeekdayInAnchorWeek(
  date: Date,
  weekdays: string[],
  fallbackWeekday: number
) {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  const normalizedWeekdays = weekdays
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  const candidates = (normalizedWeekdays.length > 0
    ? normalizedWeekdays
    : [fallbackWeekday]
  )
    .map((weekday) => {
      const candidate = new Date(weekStart);
      candidate.setDate(weekStart.getDate() + weekday);
      return candidate;
    })
    .sort((left, right) => left.getTime() - right.getTime());

  return candidates[0] ?? date;
}

function parseLocalDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalDate(date: Date) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}
