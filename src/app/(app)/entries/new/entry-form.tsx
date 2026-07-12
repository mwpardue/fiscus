"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import {
  describeGeneratedSchedule,
  generateDueDates,
  type ScheduleBasis
} from "@/lib/recurrence/generated";
import {
  createEntryAction,
  type NewEntryActionState
} from "./actions";
import { ColorTagPicker } from "../color-tag-picker";

const initialState: NewEntryActionState = {
  status: "idle"
};

export function EntryForm({
  accounts,
  defaultCurrencyCode,
  returnTo,
  themeToken
}: {
  accounts: Array<{ id: string; name: string }>;
  defaultCurrencyCode: string;
  returnTo?: string;
  themeToken: string;
}) {
  const [state, formAction, pending] = useActionState(
    createEntryAction,
    initialState
  );
  const [scheduleMode, setScheduleMode] = useState<
    "ongoing" | "finite" | "manual"
  >("ongoing");
  const [recurrenceType, setRecurrenceType] = useState<"date" | "day">("date");
  const [scheduleBasis, setScheduleBasis] = useState<ScheduleBasis>("date");
  const [dayPattern, setDayPattern] = useState<"weekly" | "monthly">("weekly");
  const [intervalUnit, setIntervalUnit] = useState<
    "day" | "week" | "month" | "year"
  >("month");
  const [intervalCount, setIntervalCount] = useState("1");
  const [occurrenceCount, setOccurrenceCount] = useState("6");
  const [anchorDate, setAnchorDate] = useState(getNextDayDate);
  const anchorDateTouched = useRef(false);
  const [expectedAmount, setExpectedAmount] = useState("");
  const [manualRows, setManualRows] = useState([
    { amount: "", amountStatus: "fixed", date: getNextDayDate() }
  ]);
  const [weekday, setWeekday] = useState("3");
  const [selectedWeekdays, setSelectedWeekdays] = useState(["3"]);
  const [ordinalWeek, setOrdinalWeek] = useState("-1");
  const [shortMonthBehavior, setShortMonthBehavior] = useState<
    "last_day" | "next_month" | "skip"
  >("last_day");
  const [accountMode, setAccountMode] = useState<"none" | "existing" | "new">(
    "none"
  );
  const [selectedAccountId, setSelectedAccountId] = useState("");
  useEffect(() => {
    if (scheduleMode !== "manual" || !expectedAmount) {
      return;
    }

    setManualRows((rows) =>
      rows.map((row) =>
        row.amount
          ? row
          : { ...row, amount: expectedAmount, amountStatus: "fixed" }
      )
    );
  }, [expectedAmount, scheduleMode]);
  useEffect(() => {
    if (anchorDateTouched.current || scheduleMode === "manual") {
      return;
    }

    setAnchorDate(
      getDefaultAnchorDate({
        ordinalWeek: Number(ordinalWeek),
        scheduleBasis,
        selectedWeekdays,
        weekday: Number(weekday)
      })
    );
  }, [ordinalWeek, scheduleBasis, scheduleMode, selectedWeekdays, weekday]);
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

    return (
      generateDueDates({
        anchorDate,
        count: previewCount,
        intervalCount: Number(intervalCount) || 0,
        intervalUnit,
        ordinalWeek: Number(ordinalWeek),
        scheduleBasis,
        shortMonthBehavior,
        weekday: Number(weekday)
      })
    );
  },
    [
      anchorDate,
      intervalCount,
      intervalUnit,
      manualRows,
      ordinalWeek,
      previewCount,
      selectedWeekdays,
      scheduleBasis,
      scheduleMode,
      shortMonthBehavior,
      weekday
    ]
  );
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
    <form action={formAction} className="grid gap-5">
      <input name="returnTo" type="hidden" value={returnTo ?? ""} />

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-ink">Type</legend>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
          <label className="flex min-h-12 items-center justify-center rounded border border-line bg-white px-3 text-sm font-semibold">
            <input
              className="mr-2"
              type="radio"
              name="kind"
              value="bill"
              defaultChecked
            />
            Bill
          </label>
          <label className="flex min-h-12 items-center justify-center rounded border border-line bg-white px-3 text-sm font-semibold">
            <input className="mr-2" type="radio" name="kind" value="income" />
            Income
          </label>
          <ColorTagPicker themeToken={themeToken} />
        </div>
      </fieldset>

      <label className="grid gap-2 text-sm font-medium text-ink">
        Plan name
        <input
          className="min-h-12 rounded border border-line bg-white px-3 text-base"
          name="name"
          placeholder="Mortgage, paycheck, phone bill"
          required
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
          Category
          <input
            className="min-h-12 rounded border border-line bg-white px-3 text-base"
            name="categoryName"
            placeholder="Food, utilities, subscriptions"
          />
        </label>

        <div className="grid min-w-0 gap-2 text-sm font-medium text-ink">
          <label htmlFor="new-event-account">Account</label>
          <select
            id="new-event-account"
            className="min-h-12 rounded border border-line bg-white px-3 text-base"
            name="accountChoice"
            value={
              accountMode === "existing"
                ? selectedAccountId
                : accountMode === "new"
                  ? "__new__"
                  : ""
            }
            onChange={(event) => {
              if (event.target.value === "__new__") {
                setAccountMode("new");
                return;
              }

              if (event.target.value === "") {
                setAccountMode("none");
                setSelectedAccountId("");
                return;
              }

              setAccountMode("existing");
              setSelectedAccountId(event.target.value);
            }}
          >
            <option value="">No account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
            <option value="__new__">New account...</option>
          </select>
        </div>
      </div>

      <input name="accountMode" type="hidden" value={accountMode} />
      {accountMode === "existing" ? (
        <input name="counterpartyId" type="hidden" value={selectedAccountId} />
      ) : null}

      {accountMode === "new" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
            New account name
            <input
              className="min-h-12 rounded border border-line bg-white px-3 text-base"
              name="counterpartyName"
              placeholder="Merchant, biller, payer, employer"
              required
            />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
            Account website
            <input
              className="min-h-12 rounded border border-line bg-white px-3 text-base"
              name="counterpartyWebsiteUrl"
              placeholder="att.com"
              type="text"
            />
            <span className="text-xs text-gray-700">
              Helps match the right logo.
            </span>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
            Account icon
            <input
              accept="image/png,image/jpeg,image/webp"
              className="min-h-12 w-full min-w-0 rounded border border-line bg-white px-3 py-2 text-sm"
              name="accountIcon"
              type="file"
            />
            <span className="text-xs text-gray-700">
              If no image is uploaded, the app will try to find a logo and then use initials.
            </span>
          </label>
        </div>
      ) : null}

      <div className="grid gap-4">
        <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
          Plan icon override
          <input
            accept="image/png,image/jpeg,image/webp"
            className="min-h-12 w-full min-w-0 rounded border border-line bg-white px-3 py-2 text-sm"
            name="planIcon"
            type="file"
          />
          <span className="text-xs text-gray-700">
            Leave blank to inherit the account icon.
          </span>
        </label>
      </div>

      <input name="currencyCode" type="hidden" value={defaultCurrencyCode} />

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-ink">Amount</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex min-h-12 items-center rounded border border-line bg-white px-3 text-sm font-medium">
            <input
              className="mr-2"
              type="radio"
              name="amountStatus"
              value="fixed"
              defaultChecked
            />
            Fixed
          </label>
          <label className="flex min-h-12 items-center rounded border border-line bg-white px-3 text-sm font-medium">
            <input
              className="mr-2"
              type="radio"
              name="amountStatus"
              value="estimated"
            />
            Estimated
          </label>
          <label className="flex min-h-12 items-center rounded border border-line bg-white px-3 text-sm font-medium">
            <input
              className="mr-2"
              type="radio"
              name="amountStatus"
              value="unknown"
            />
            Unknown
          </label>
        </div>
      </fieldset>

      <label className="grid gap-2 text-sm font-medium text-ink">
        Expected amount
        <span className="grid min-h-12 grid-cols-[1fr_auto] overflow-hidden rounded border border-line bg-white">
          <input
            className="min-w-0 border-0 bg-transparent px-3 text-base outline-none"
            name="expectedAmount"
            inputMode="decimal"
            value={expectedAmount}
            onChange={(event) => setExpectedAmount(event.target.value)}
            placeholder="125.00"
          />
          <span className="flex items-center border-l border-line bg-paper px-3 text-sm font-semibold text-gray-700">
            {defaultCurrencyCode}
          </span>
        </span>
      </label>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-ink">Schedule</legend>
        <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
          <div className="grid gap-2">
            <label className="flex min-h-12 items-center rounded border border-line bg-white px-3 text-sm font-medium">
              <input
                className="mr-2"
                type="radio"
                name="scheduleMode"
                value="ongoing"
                checked={scheduleMode === "ongoing"}
                onChange={() => setScheduleMode("ongoing")}
              />
              Ongoing
            </label>
            <label className="flex min-h-12 items-center rounded border border-line bg-white px-3 text-sm font-medium">
              <input
                className="mr-2"
                type="radio"
                name="scheduleMode"
                value="finite"
                checked={scheduleMode === "finite"}
                onChange={() => setScheduleMode("finite")}
              />
              Finite
            </label>
            <label className="flex min-h-12 items-center rounded border border-line bg-white px-3 text-sm font-medium">
              <input
                className="mr-2"
                type="radio"
                name="scheduleMode"
                value="manual"
                checked={scheduleMode === "manual"}
                onChange={() => setScheduleMode("manual")}
              />
              Manual
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Events
            <input
              className="min-h-12 rounded border border-line bg-white px-3 text-base disabled:bg-paper disabled:text-gray-600"
              disabled={scheduleMode !== "finite"}
              min={1}
              max={120}
              name="occurrenceCount"
              type="number"
              value={occurrenceCount}
              onChange={(event) => setOccurrenceCount(event.target.value)}
              required={scheduleMode === "finite"}
            />
          </label>
        </div>
      </fieldset>

      {scheduleMode !== "manual" ? (
        <div className="grid gap-4 sm:grid-cols-3 sm:items-start">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Recurrence type
            <select
              className="min-h-12 rounded border border-line bg-white px-3 text-base"
              value={recurrenceType}
              onChange={(event) => {
                const nextType = event.target.value as "date" | "day";
                setRecurrenceType(nextType);
                if (nextType === "date") {
                  setScheduleBasis("date");
                  setIntervalUnit("month");
                  if (!anchorDateTouched.current) {
                    setAnchorDate(getNextDayDate());
                  }
                } else {
                  const nextBasis =
                    dayPattern === "weekly" ? "weekday" : "month_weekday";
                  setScheduleBasis(nextBasis);
                  setIntervalUnit(dayPattern === "weekly" ? "week" : "month");
                  if (!anchorDateTouched.current) {
                    setAnchorDate(
                      getDefaultAnchorDate({
                        ordinalWeek: Number(ordinalWeek),
                        scheduleBasis: nextBasis,
                        selectedWeekdays,
                        weekday: Number(weekday)
                      })
                    );
                  }
                }
              }}
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
                value={dayPattern}
                onChange={(event) => {
                  const nextPattern = event.target.value as "weekly" | "monthly";
                  setDayPattern(nextPattern);
                  setScheduleBasis(
                    nextPattern === "weekly" ? "weekday" : "month_weekday"
                  );
                  setIntervalUnit(nextPattern === "weekly" ? "week" : "month");
                  if (!anchorDateTouched.current) {
                    setAnchorDate(
                      getDefaultAnchorDate({
                        ordinalWeek: Number(ordinalWeek),
                        scheduleBasis:
                          nextPattern === "weekly"
                            ? "weekday"
                            : "month_weekday",
                        selectedWeekdays,
                        weekday: Number(weekday)
                      })
                    );
                  }
                }}
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
              min={1}
              max={24}
              name="intervalCount"
              type="number"
              value={intervalCount}
              onChange={(event) => setIntervalCount(event.target.value)}
              required
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
                value={intervalUnit}
                onChange={(event) =>
                  setIntervalUnit(
                    event.target.value as "day" | "week" | "month" | "year"
                  )
                }
              >
                <option value="day">Days</option>
                <option value="week">Weeks</option>
                <option value="month">Months</option>
                <option value="year">Years</option>
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      {scheduleMode !== "manual" && recurrenceType === "day" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="intervalUnit" type="hidden" value={intervalUnit} />

          {dayPattern === "monthly" ? (
            <label className="grid gap-2 text-sm font-medium text-ink">
              Week
              <select
                className="min-h-12 rounded border border-line bg-white px-3 text-base"
                name="ordinalWeek"
                value={ordinalWeek}
                onChange={(event) => setOrdinalWeek(event.target.value)}
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
                    <label
                      className="relative cursor-pointer"
                      key={option.value}
                    >
                      <input
                        className="sr-only"
                        name="weekday"
                        type="checkbox"
                        value={option.value}
                        checked={selected}
                        onChange={(event) => {
                          setSelectedWeekdays((current) => {
                            if (event.target.checked) {
                              return Array.from(new Set([...current, option.value]));
                            }

                            const next = current.filter(
                              (value) => value !== option.value
                            );
                            return next.length > 0 ? next : current;
                          });
                          setWeekday(option.value);
                        }}
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
                value={weekday}
                onChange={(event) => setWeekday(event.target.value)}
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

      {scheduleMode !== "manual" &&
      recurrenceType === "date" &&
      (intervalUnit === "month" || intervalUnit === "year") ? (
        <label className="grid gap-2 text-sm font-medium text-ink">
          Short-month behavior
          <select
            className="min-h-12 rounded border border-line bg-white px-3 text-base"
            name="shortMonthBehavior"
            value={shortMonthBehavior}
            onChange={(event) =>
              setShortMonthBehavior(
                event.target.value as "last_day" | "next_month" | "skip"
              )
            }
          >
            <option value="last_day">Use final day</option>
            <option value="next_month">Roll into next month</option>
            <option value="skip">Skip that month</option>
          </select>
        </label>
      ) : (
        <input name="shortMonthBehavior" type="hidden" value={shortMonthBehavior} />
      )}

      {scheduleMode !== "manual" ? (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold text-ink">Dates</h2>
          <label className="grid gap-2 text-sm font-medium text-ink">
            First due date
            <input
              className="min-h-12 rounded border border-line bg-white px-3 text-base"
              name="anchorDate"
              type="date"
              value={anchorDate}
              onChange={(event) => {
                anchorDateTouched.current = true;
                setAnchorDate(event.target.value);
              }}
              required
            />
          </label>
        </section>
      ) : null}

      {scheduleMode === "manual" ? (
        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Dates</h2>
            <button
              className="min-h-10 rounded border border-line bg-white px-3 text-sm font-semibold"
              type="button"
            onClick={() =>
              setManualRows((rows) => [
                ...rows,
                {
                  amount: expectedAmount,
                  amountStatus: "fixed",
                  date: getNextDayDate()
                }
              ])
            }
            >
              Add date
            </button>
          </div>
          <div className="grid gap-2">
            {manualRows.map((row, index) => (
              <div
                className="grid gap-2 sm:grid-cols-[1fr_10rem_1fr_auto]"
                key={index}
              >
                <label className="sr-only" htmlFor={`manual-date-${index}`}>
                  Manual due date {index + 1}
                </label>
                <input
                  className="min-h-12 rounded border border-line bg-white px-3 text-base"
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
                <select
                  className="min-h-12 rounded border border-line bg-white px-3 text-base"
                  name="manualAmountStatus"
                  value={row.amountStatus}
                  onChange={(event) =>
                    setManualRows((rows) =>
                      rows.map((existingRow, rowIndex) =>
                        rowIndex === index
                          ? { ...existingRow, amountStatus: event.target.value }
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
                  className="min-h-12 rounded border border-line bg-white px-3 text-base disabled:bg-paper"
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
                <button
                  className="min-h-12 rounded border border-line bg-white px-3 text-sm font-semibold disabled:opacity-50"
                  type="button"
                  disabled={manualRows.length === 1}
                  onClick={() =>
                    setManualRows((rows) =>
                      rows.filter((_, rowIndex) => rowIndex !== index)
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 rounded border border-line bg-paper p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">Preview</h2>
          <p className="text-xs font-medium text-gray-700">
            {previewDates.length} dates
          </p>
        </div>
        <p className="text-sm text-gray-700">{scheduleDescription}</p>
        {previewDates.length > 0 ? (
          <ol className="grid max-h-56 gap-2 overflow-auto text-sm text-ink sm:grid-cols-2">
            {previewDates.map((date, index) => (
              <li
                className="flex items-center justify-between rounded border border-line bg-white px-3 py-2"
                key={`${date}-${index}`}
              >
                <span>#{index + 1}</span>
                <span className="font-semibold">{date}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded border border-line bg-white px-3 py-2 text-sm text-gray-700">
            Enter a first due date to preview the generated schedule.
          </p>
        )}
      </section>

      <button
        className="min-h-12 rounded bg-mint px-4 font-semibold text-white disabled:opacity-60"
        disabled={pending}
      >
        Create event
      </button>

      {state.message ? (
        <p className="rounded border border-danger/30 bg-white px-3 py-2 text-sm text-danger">
          {state.message}
        </p>
      ) : null}
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

function getDefaultAnchorDate({
  ordinalWeek,
  scheduleBasis,
  selectedWeekdays,
  weekday
}: {
  ordinalWeek: number;
  scheduleBasis: ScheduleBasis;
  selectedWeekdays: string[];
  weekday: number;
}) {
  const tomorrow = getTomorrow();

  if (scheduleBasis === "weekday") {
    const firstWeekday = Number(selectedWeekdays[0] ?? weekday);
    return formatLocalDate(nextWeekdayOnOrAfter(tomorrow, firstWeekday));
  }

  if (scheduleBasis === "month_weekday") {
    return formatLocalDate(
      nextMonthlyWeekdayOnOrAfter(tomorrow, ordinalWeek, weekday)
    );
  }

  return formatLocalDate(tomorrow);
}

function getNextDayDate() {
  return formatLocalDate(getTomorrow());
}

function getTomorrow() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date;
}

function nextWeekdayOnOrAfter(date: Date, weekday: number) {
  const nextDate = new Date(date);
  const normalizedWeekday = normalizeWeekday(weekday);
  const dayOffset = (normalizedWeekday - nextDate.getDay() + 7) % 7;
  nextDate.setDate(nextDate.getDate() + dayOffset);
  return nextDate;
}

function nextMonthlyWeekdayOnOrAfter(
  date: Date,
  ordinalWeek: number,
  weekday: number
) {
  const normalizedOrdinal = [-1, 1, 2, 3, 4].includes(ordinalWeek)
    ? ordinalWeek
    : 1;
  const normalizedWeekday = normalizeWeekday(weekday);

  for (let monthOffset = 0; monthOffset < 24; monthOffset += 1) {
    const monthStart = new Date(
      date.getFullYear(),
      date.getMonth() + monthOffset,
      1
    );
    const candidate = getMonthlyWeekday(
      monthStart,
      normalizedOrdinal,
      normalizedWeekday
    );

    if (candidate && candidate >= date) {
      return candidate;
    }
  }

  return date;
}

function getMonthlyWeekday(monthStart: Date, ordinalWeek: number, weekday: number) {
  if (ordinalWeek === -1) {
    const candidate = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0
    );
    const offset = (candidate.getDay() - weekday + 7) % 7;
    candidate.setDate(candidate.getDate() - offset);
    return candidate;
  }

  const candidate = new Date(monthStart);
  const offset = (weekday - candidate.getDay() + 7) % 7;
  candidate.setDate(1 + offset + (ordinalWeek - 1) * 7);

  if (candidate.getMonth() !== monthStart.getMonth()) {
    return null;
  }

  return candidate;
}

function normalizeWeekday(weekday: number) {
  return Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : 0;
}

function formatLocalDate(date: Date) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}
