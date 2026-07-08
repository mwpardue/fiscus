import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { EntityIcon } from "@/app/(app)/entity-icon";
import { SwipeableEventCard } from "@/app/(app)/swipeable-event-card";
import {
  formatMinorAmount,
  formatMinorAmountForInput
} from "@/lib/money";
import {
  DEFAULT_THEME_TOKEN,
  getColorTag
} from "@/lib/color-tags";
import { resolveEntityIcons } from "@/lib/entity-icons";
import {
  isOverdue,
  summarizeOccurrences,
  type DashboardOccurrence
} from "@/lib/occurrences";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  archiveOccurrenceAction,
  completeOccurrenceFromCardAction
} from "../occurrences/actions";
import { updateBalanceAnchorAction } from "./actions";

type DashboardPayment = {
  amount_minor: number;
  created_at: string;
  kind: "payment" | "receipt";
  status: "active" | "voided";
};

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ day?: string; month?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = new Date().toISOString().slice(0, 10);
  const params = await searchParams;
  const selectedMonth = normalizeMonthParam(params?.month, today);
  const selectedDay = normalizeDayParam(params?.day, selectedMonth);
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "balance_anchor_amount_minor,balance_anchor_recorded_at,default_currency_code,theme_token,week_starts_on"
    )
    .eq("user_id", user.id)
    .maybeSingle();
  const defaultCurrencyCode = profile?.default_currency_code ?? "USD";
  const themeToken = profile?.theme_token ?? DEFAULT_THEME_TOKEN;
  const weekStartsOn = profile?.week_starts_on ?? 0;
  const balanceAnchorAmountMinor =
    profile?.balance_anchor_amount_minor ?? null;
  const balanceAnchorRecordedAt =
    profile?.balance_anchor_recorded_at ?? null;
  const calendarFrame = buildCalendarFrame(selectedMonth, weekStartsOn);
  const [
    { data: occurrences, error },
    { data: payments },
    { data: counterparties }
  ] = await Promise.all([
    supabase
      .from("occurrences")
      .select(
        "id,due_date,amount_status,expected_amount_minor,currency_code,lifecycle_status,financial_items(name,kind,color_token,counterparty_id,icon_storage_path,brandfetch_icon_url)"
      )
      .is("archived_at", null)
      .eq("lifecycle_status", "upcoming")
      .gte("due_date", calendarFrame.visibleStart)
      .lte("due_date", calendarFrame.visibleEnd)
      .order("due_date", { ascending: true }),
    balanceAnchorRecordedAt
      ? supabase
          .from("payments")
          .select("amount_minor,created_at,kind,status")
          .eq("status", "active")
          .gt("created_at", balanceAnchorRecordedAt)
      : Promise.resolve({ data: [] as DashboardPayment[] }),
    supabase.from("counterparties").select("id,icon_storage_path,brandfetch_icon_url")
  ]);

  const calendarOccurrenceRows = (occurrences ?? []) as DashboardOccurrence[];
  const visibleOccurrenceRows = selectedDay
    ? calendarOccurrenceRows.filter((occurrence) => occurrence.due_date === selectedDay)
    : calendarOccurrenceRows;
  const accountIconById = new Map(
    (counterparties ?? []).map((counterparty) => [
      counterparty.id,
      {
        brandfetchIconUrl: counterparty.brandfetch_icon_url,
        iconPath: counterparty.icon_storage_path
      }
    ])
  );
  const eventIcons = await resolveEntityIcons(
    supabase,
    visibleOccurrenceRows.map((occurrence) => ({
      accountBrandfetchIconUrl: occurrence.financial_items?.counterparty_id
        ? accountIconById.get(occurrence.financial_items.counterparty_id)
            ?.brandfetchIconUrl ?? null
        : null,
      accountIconPath: occurrence.financial_items?.counterparty_id
        ? accountIconById.get(occurrence.financial_items.counterparty_id)
            ?.iconPath ?? null
        : null,
      planBrandfetchIconUrl: occurrence.financial_items?.brandfetch_icon_url ?? null,
      planIconPath: occurrence.financial_items?.icon_storage_path ?? null,
      title: occurrence.financial_items?.name ?? "Untitled"
    }))
  );
  const iconByOccurrenceId = new Map(
    visibleOccurrenceRows.map((occurrence, index) => [
      occurrence.id,
      eventIcons[index]
    ])
  );
  const summary = summarizeOccurrences(visibleOccurrenceRows);
  const completedActivityMinor = summarizeCompletedActivity(
    (payments ?? []) as DashboardPayment[]
  );
  const adjustedCurrentBalanceMinor =
    balanceAnchorAmountMinor === null
      ? null
      : balanceAnchorAmountMinor + completedActivityMinor;
  const weeklyGroups = buildWeeklyOccurrenceGroups(
    visibleOccurrenceRows,
    weekStartsOn,
    adjustedCurrentBalanceMinor
  );
  const calendar = fillCalendarCounts(calendarFrame, calendarOccurrenceRows);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="border-b border-line pb-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
          </div>
        </header>

        <section className="grid gap-3 rounded border border-line bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(14rem,auto)] md:items-end">
          <form action={updateBalanceAnchorAction} className="grid gap-2">
            <input name="month" type="hidden" value={selectedMonth} />
            <label className="grid gap-1 text-sm font-medium text-ink">
              Current checking balance
              <span className="grid min-h-12 grid-cols-[1fr_auto] overflow-hidden rounded border border-line bg-white">
                <input
                  className="min-w-0 border-0 bg-transparent px-3 text-base outline-none"
                  name="balance"
                  inputMode="decimal"
                  placeholder="1250.00"
                  defaultValue={
                    balanceAnchorAmountMinor === null
                      ? ""
                      : formatMinorAmountForInput(balanceAnchorAmountMinor)
                  }
                />
                <span className="flex items-center border-l border-line bg-paper px-3 text-sm font-semibold text-gray-700">
                  {defaultCurrencyCode}
                </span>
              </span>
            </label>
            <button className="min-h-10 rounded bg-mint px-3 text-sm font-semibold text-white sm:max-w-40">
              Save balance
            </button>
          </form>
          <div className="rounded border border-line bg-paper p-4">
            <p className="text-sm text-gray-700">Available balance</p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {adjustedCurrentBalanceMinor === null
                ? "Not set"
                : formatMinorAmount(
                    adjustedCurrentBalanceMinor,
                    defaultCurrencyCode
                  )}
            </p>
            <p className="mt-1 text-sm text-gray-700">
              {balanceAnchorRecordedAt
                ? `Updated ${formatTimestampLabel(balanceAnchorRecordedAt)}`
                : "Enter a balance to start projections."}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 rounded border border-line bg-white p-4">
          <ProjectionMetric
            label="Projected incoming"
            value={formatMinorAmount(summary.incomingMinor, defaultCurrencyCode)}
          />
          <ProjectionMetric
            label="Projected outgoing"
            value={formatMinorAmount(summary.outgoingMinor, defaultCurrencyCode)}
          />
        </section>

        {summary.unknownCount > 0 ? (
          <section className="rounded border border-danger/30 bg-white p-4 text-danger">
            <p className="text-sm font-semibold">Unknown amounts</p>
            <p className="mt-1 text-sm leading-6">
              {summary.unknownCount} visible{" "}
              {summary.unknownCount === 1 ? "event has" : "events have"} an
              unknown amount and are not included in projected totals.
            </p>
          </section>
        ) : null}

        <section className="grid gap-3 rounded border border-line bg-white p-4">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <Link
              aria-label="Previous month"
              className="inline-flex h-10 w-10 items-center justify-center rounded border border-line bg-white text-ink"
              href={`/dashboard?month=${calendar.previousMonth}`}
            >
              <ChevronLeftIcon />
            </Link>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-ink">{calendar.label}</h2>
            </div>
            <Link
              aria-label="Next month"
              className="inline-flex h-10 w-10 items-center justify-center rounded border border-line bg-white text-ink"
              href={`/dashboard?month=${calendar.nextMonth}`}
            >
              <ChevronRightIcon />
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-1" aria-label={`${calendar.label} upcoming activity calendar`}>
            {calendar.weekdays.map((weekday) => (
              <div
                className="py-1 text-center text-xs font-semibold uppercase text-gray-600"
                key={weekday}
              >
                {weekday}
              </div>
            ))}
            {calendar.days.map((day) => (
              <Link
                aria-label={
                  `${day.label}, ${day.count} scheduled events`
                }
                className={
                  [
                    "min-h-14 rounded border p-2",
                    day.date === selectedDay
                      ? "border-mint bg-mint/10"
                      : day.inCurrentMonth
                        ? "border-line bg-paper"
                        : "border-line bg-white text-gray-500"
                  ].join(" ")
                }
                href={buildDashboardHref(day.date.slice(0, 7), day.date)}
                key={day.date}
              >
                <div className="flex h-full flex-col justify-between gap-1">
                  <span
                    className={
                      day.inCurrentMonth
                        ? "text-sm font-semibold text-ink"
                        : "text-sm font-semibold text-gray-500"
                    }
                  >
                    {day.dayOfMonth}
                  </span>
                  {day.count > 0 ? (
                    <span className="inline-flex h-6 min-w-6 items-center justify-center self-end rounded-full bg-mint px-2 text-xs font-semibold text-white">
                      {day.count}
                    </span>
                  ) : (
                    <span className="sr-only">No scheduled events</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Activity in view</h2>
              {selectedDay ? (
                <p className="text-sm text-gray-700">
                  {formatSelectedDayLabel(selectedDay)}
                </p>
              ) : null}
            </div>
            {selectedDay ? (
              <Link
                className="text-sm font-semibold text-mint"
                href={`/dashboard?month=${selectedMonth}`}
              >
                Clear day
              </Link>
            ) : null}
          </div>

          {error ? (
            <p className="rounded border border-danger/30 bg-white p-4 text-sm text-danger">
              Unable to load activity right now.
            </p>
          ) : null}

          {!error && visibleOccurrenceRows.length === 0 ? (
            <div className="rounded border border-line bg-white p-5">
              <p className="font-medium text-ink">No activity in this calendar view.</p>
              <p className="mt-1 text-sm leading-6 text-gray-700">
                Create a plan or move to another month to find scheduled activity.
              </p>
              <Link
                className="mt-4 inline-flex min-h-11 items-center rounded bg-mint px-4 text-sm font-semibold text-white"
                href="/events/new"
              >
                New
              </Link>
            </div>
          ) : null}

          <div className="grid gap-4">
            {weeklyGroups.map((week) => (
              <section
                className="grid gap-2"
                key={`${week.weekStart}-${week.weekEnd}`}
              >
                <div>
                  <h3 className="font-semibold text-ink">
                    {formatWeekRange(week.weekStart, week.weekEnd)}
                  </h3>
                  <p className="text-sm text-gray-700">
                    {week.occurrences.length} scheduled{" "}
                    {week.occurrences.length === 1 ? "event" : "events"}
                  </p>
                </div>

                {week.occurrences.map((occurrence) => {
                  const icon = iconByOccurrenceId.get(occurrence.id) ?? {
                    alt: `${occurrence.financial_items?.name ?? "Untitled"} icon`,
                    brandfetchUrl: null,
                    initials: "?",
                    signedUrl: null
                  };
                  const amountLabel =
                    occurrence.amount_status === "unknown"
                      ? "Unknown"
                      : formatMinorAmount(
                          occurrence.expected_amount_minor ?? 0,
                          occurrence.currency_code
                        );
                  const returnTo = `/dashboard?month=${selectedMonth}`;
                  const leadingAction =
                    occurrence.lifecycle_status === "upcoming" &&
                    occurrence.amount_status !== "unknown" &&
                    occurrence.expected_amount_minor !== null
                      ? (
                          <form action={completeOccurrenceFromCardAction}>
                            <input name="id" type="hidden" value={occurrence.id} />
                            <input name="returnTo" type="hidden" value={returnTo} />
                            <input name="completedOn" type="hidden" value={today} />
                            <input
                              name="amount"
                              type="hidden"
                              value={formatMinorAmountForInput(
                                occurrence.expected_amount_minor
                              )}
                            />
                            <button className="swipe-complete-action" type="submit">
                              {occurrence.financial_items?.kind === "income"
                                ? "Receive"
                                : "Pay"}
                            </button>
                          </form>
                        )
                      : null;

                  return (
                    <SwipeableEventCard
                      key={occurrence.id}
                      leadingAction={leadingAction}
                      trailingAction={
                        <form action={archiveOccurrenceAction}>
                          <input name="id" type="hidden" value={occurrence.id} />
                          <input name="returnTo" type="hidden" value={returnTo} />
                          <button className="swipe-delete-action" type="submit">
                            Delete
                          </button>
                        </form>
                      }
                    >
                      <article
                        className="relative grid gap-2 p-3 pr-12 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        style={entryAccentStyle(
                          occurrence.financial_items?.color_token,
                          themeToken
                        )}
                      >
                        <Link
                          aria-label={`Edit ${occurrence.financial_items?.name ?? "event"}`}
                          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded border border-line bg-white text-ink"
                          href={`/events/${occurrence.id}/edit`}
                          title="Edit"
                        >
                          <PencilIcon />
                        </Link>
                        <div className="flex min-w-0 gap-2">
                          <EntityIcon icon={icon} size="sm" />
                          <div className="grid min-w-0 gap-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <h3 className="truncate font-semibold text-ink">
                                {occurrence.financial_items?.name ?? "Untitled"}
                              </h3>
                              <span className="rounded border border-line px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase text-gray-700">
                                {occurrence.financial_items?.kind ?? "item"}
                              </span>
                              {isOverdue(occurrence, today) ? (
                                <span className="rounded border border-danger/30 px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase text-danger">
                                  overdue
                                </span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-sm text-gray-700">
                              <span>Due {occurrence.due_date}</span>
                              <span>{occurrence.lifecycle_status}</span>
                              <span>{occurrence.amount_status}</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:min-w-36 sm:text-right">
                          <p className="text-base font-semibold text-ink">
                            {amountLabel}
                          </p>
                        </div>
                      </article>
                    </SwipeableEventCard>
                  );
                })}

                <div className="grid gap-1 rounded border border-line bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <p className="text-sm font-medium text-gray-700">
                    Weekly projected change:{" "}
                    <span className="text-ink">
                      {formatDelta(week.projectedDeltaMinor, defaultCurrencyCode)}
                    </span>
                  </p>
                  <div className="sm:text-right">
                    <p className="text-sm text-gray-700">Projected week-end balance</p>
                    <p className="text-xl font-semibold text-ink">
                      {week.endingBalanceMinor === null
                        ? "Set balance"
                        : formatMinorAmount(
                            week.endingBalanceMinor,
                            defaultCurrencyCode
                          )}
                    </p>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
      <Link
        aria-label="New event"
        className="fixed bottom-5 right-5 z-20 inline-flex h-14 w-14 items-center justify-center rounded-full bg-mint text-white shadow-lg shadow-black/20"
        href="/events/new"
        title="New event"
      >
        <PencilIcon />
      </Link>
    </main>
  );
}

function entryAccentStyle(
  colorToken: string | null | undefined,
  themeToken: string | null | undefined
) {
  const color = getColorTag(colorToken, themeToken);

  if (!color) {
    return undefined;
  }

  return {
    borderLeft: `6px solid ${color.background}`
  };
}

function ProjectionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1">
      <p className="text-sm text-gray-700">{label}</p>
      <p className="truncate text-lg font-semibold text-ink sm:text-xl">
        {value}
      </p>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function summarizeCompletedActivity(payments: DashboardPayment[]) {
  return payments.reduce((total, payment) => {
    if (payment.status !== "active") {
      return total;
    }

    return payment.kind === "receipt"
      ? total + payment.amount_minor
      : total - payment.amount_minor;
  }, 0);
}

function buildWeeklyOccurrenceGroups(
  occurrences: DashboardOccurrence[],
  weekStartsOn: number,
  startingBalanceMinor: number | null
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

  let runningBalanceMinor = startingBalanceMinor;

  return Array.from(grouped.values())
    .sort((first, second) => first.weekStart.localeCompare(second.weekStart))
    .map((group) => {
      if (runningBalanceMinor !== null) {
        runningBalanceMinor += group.projectedDeltaMinor;
      }

      return {
        ...group,
        endingBalanceMinor: runningBalanceMinor
      };
    });
}

function getProjectedOccurrenceDelta(occurrence: DashboardOccurrence) {
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

function formatWeekRange(weekStart: string, weekEnd: string) {
  return `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`;
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  }).format(parseDateOnly(date));
}

function formatTimestampLabel(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function formatDelta(amountMinor: number, currencyCode: string) {
  if (amountMinor === 0) {
    return "No projected change";
  }

  const formatted = formatMinorAmount(Math.abs(amountMinor), currencyCode);
  return amountMinor > 0 ? `+${formatted}` : `-${formatted}`;
}

function buildCalendarFrame(month: string, weekStartsOn: number) {
  const currentDate = parseDateOnly(`${month}-01`);
  const monthStart = new Date(
    Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1)
  );
  const monthEnd = new Date(
    Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0)
  );
  const normalizedWeekStart = Math.min(Math.max(weekStartsOn, 0), 6);
  const leadingBlankCount =
    (monthStart.getUTCDay() - normalizedWeekStart + 7) % 7;
  const days = [];

  for (let blank = leadingBlankCount; blank > 0; blank -= 1) {
    const date = new Date(monthStart);
    date.setUTCDate(date.getUTCDate() - blank);
    days.push({
      count: 0,
      date: formatDateOnly(date),
      dayOfMonth: date.getUTCDate(),
      inCurrentMonth: false,
      label: formatCalendarDayLabel(date)
    });
  }

  for (let day = 1; day <= monthEnd.getUTCDate(); day += 1) {
    const date = new Date(
      Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), day)
    );
    const dateKey = formatDateOnly(date);
    days.push({
      count: 0,
      date: dateKey,
      dayOfMonth: day,
      inCurrentMonth: true,
      label: formatCalendarDayLabel(date)
    });
  }

  let trailingBlank = 1;
  while (days.length % 7 !== 0) {
    const date = new Date(monthEnd);
    date.setUTCDate(date.getUTCDate() + trailingBlank);
    days.push({
      count: 0,
      date: formatDateOnly(date),
      dayOfMonth: date.getUTCDate(),
      inCurrentMonth: false,
      label: formatCalendarDayLabel(date)
    });
    trailingBlank += 1;
  }

  return {
    days,
    label: new Intl.DateTimeFormat("en-US", {
      month: "long",
      timeZone: "UTC",
      year: "numeric"
    }).format(monthStart),
    nextMonth: shiftMonth(monthStart, 1),
    previousMonth: shiftMonth(monthStart, -1),
    visibleEnd: days[days.length - 1]?.date ?? formatDateOnly(monthEnd),
    visibleStart: days[0]?.date ?? formatDateOnly(monthStart),
    weekdays: buildWeekdays(normalizedWeekStart)
  };
}

function fillCalendarCounts(
  calendar: ReturnType<typeof buildCalendarFrame>,
  occurrences: Array<Pick<DashboardOccurrence, "due_date">>
) {
  const occurrenceCounts = occurrences.reduce<Record<string, number>>(
    (counts, occurrence) => {
      counts[occurrence.due_date] = (counts[occurrence.due_date] ?? 0) + 1;
      return counts;
    },
    {}
  );

  return {
    ...calendar,
    days: calendar.days.map((day) => ({
      ...day,
      count: occurrenceCounts[day.date] ?? 0
    }))
  };
}

function normalizeMonthParam(month: string | undefined, today: string) {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    return month;
  }

  return today.slice(0, 7);
}

function normalizeDayParam(day: string | undefined, selectedMonth: string) {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return null;
  }

  const parsed = parseDateOnly(day);

  if (formatDateOnly(parsed) !== day) {
    return null;
  }

  return day.slice(0, 7) === selectedMonth ? day : null;
}

function buildDashboardHref(month: string, day?: string) {
  const params = new URLSearchParams({ month });

  if (day) {
    params.set("day", day);
  }

  return `/dashboard?${params.toString()}` as Route;
}

function formatSelectedDayLabel(day: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "UTC"
  }).format(parseDateOnly(day));
}

function buildWeekdays(weekStartsOn: number) {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return weekdays.slice(weekStartsOn).concat(weekdays.slice(0, weekStartsOn));
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

function shiftMonth(date: Date, offset: number) {
  return formatDateOnly(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1))
  ).slice(0, 7);
}

function formatCalendarDayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long"
  }).format(date);
}
