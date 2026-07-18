import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { SwipeableEventCard } from "@/app/(app)/swipeable-event-card";
import {
  formatMinorAmount,
  formatMinorAmountForInput
} from "@/lib/money";
import {
  DEFAULT_THEME_TOKEN,
  getColorTag
} from "@/lib/color-tags";
import {
  isOverdue,
  summarizeOccurrences,
  type DashboardOccurrence
} from "@/lib/occurrences";
import { ensureOngoingOccurrencesThrough } from "@/lib/recurrence/ensure-generated";
import {
  createServerSupabaseClient,
  getRequestUser
} from "@/lib/supabase/server";
import {
  archiveOccurrenceAction,
  completeOccurrenceFromCardAction
} from "../occurrences/actions";
import { updateBalanceAnchorAction } from "./actions";
import { CalendarNavigation } from "./calendar-navigation";
import { DashboardPrefetch } from "./prefetch";

type DashboardPayment = {
  amount_minor: number;
  created_at: string;
  kind: "payment" | "receipt";
  status: "active" | "voided";
};

export const runtime = "edge";

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ day?: string; month?: string; view?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const user = await getRequestUser();

  if (!user) {
    redirect("/login");
  }

  const today = new Date().toISOString().slice(0, 10);
  const params = await searchParams;
  const selectedMonth = normalizeMonthParam(params?.month, today);
  const selectedDay = normalizeDayParam(params?.day, selectedMonth);
  const selectedView = params?.view === "calendar" ? "calendar" : "list";
  const provisionalCalendarFrame = buildCalendarFrame(selectedMonth, 0);
  const provisionalQueryBounds = expandCalendarFrameBounds(provisionalCalendarFrame);
  const queryBounds = {
    visibleEnd:
      provisionalQueryBounds.visibleEnd > today
        ? provisionalQueryBounds.visibleEnd
        : today,
    visibleStart:
      provisionalQueryBounds.visibleStart < today
        ? provisionalQueryBounds.visibleStart
        : today
  };
  await ensureOngoingOccurrencesThrough(supabase, queryBounds.visibleEnd);
  const [
    { data: profile },
    { data: occurrences, error },
    { data: projectionOccurrences },
    { data: payments },
    { data: counterparties }
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "balance_anchor_amount_minor,balance_anchor_recorded_at,default_currency_code,theme_token,week_starts_on"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("occurrences")
      .select(
        "id,due_date,amount_status,expected_amount_minor,currency_code,lifecycle_status,financial_items(name,kind,color_token,counterparty_id)"
      )
      .eq("user_id", user.id)
      .is("archived_at", null)
      .eq("lifecycle_status", "upcoming")
      .gte("due_date", queryBounds.visibleStart)
      .lte("due_date", queryBounds.visibleEnd)
      .order("due_date", { ascending: true }),
    supabase
      .from("occurrences")
      .select(
        "id,due_date,amount_status,expected_amount_minor,currency_code,lifecycle_status,financial_items(name,kind,color_token,counterparty_id)"
      )
      .eq("user_id", user.id)
      .is("archived_at", null)
      .eq("lifecycle_status", "upcoming")
      .gte("due_date", today)
      .lte("due_date", queryBounds.visibleEnd)
      .order("due_date", { ascending: true }),
    supabase
      .from("payments")
      .select("amount_minor,created_at,kind,status")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("counterparties")
      .select("id,name")
      .eq("user_id", user.id)
  ]);

  const defaultCurrencyCode = profile?.default_currency_code ?? "USD";
  const themeToken = profile?.theme_token ?? DEFAULT_THEME_TOKEN;
  const weekStartsOn = profile?.week_starts_on ?? 0;
  const balanceAnchorAmountMinor =
    profile?.balance_anchor_amount_minor ?? null;
  const balanceAnchorRecordedAt =
    profile?.balance_anchor_recorded_at ?? null;
  const calendarFrame = buildCalendarFrame(selectedMonth, weekStartsOn);
  const calendarOccurrenceRows = ((occurrences ?? []) as DashboardOccurrence[]).filter(
    (occurrence) =>
      occurrence.due_date >= calendarFrame.visibleStart &&
      occurrence.due_date <= calendarFrame.visibleEnd
  );
  const dayPanelDate = selectedDay ?? today;
  const dayPanelOccurrenceRows = ((occurrences ?? []) as DashboardOccurrence[]).filter(
    (occurrence) => occurrence.due_date === dayPanelDate
  );
  const accountById = new Map(
    (counterparties ?? []).map((counterparty) => [
      counterparty.id,
      {
        name: counterparty.name
      }
    ])
  );
  const summary = summarizeOccurrences(calendarOccurrenceRows);
  const completedActivityMinor = summarizeCompletedActivity(
    balanceAnchorRecordedAt
      ? ((payments ?? []) as DashboardPayment[]).filter(
          (payment) => payment.created_at > balanceAnchorRecordedAt
        )
      : []
  );
  const adjustedCurrentBalanceMinor =
    balanceAnchorAmountMinor === null
      ? null
      : balanceAnchorAmountMinor + completedActivityMinor;
  const weeklyGroups = buildWeeklyOccurrenceGroups(
    calendarOccurrenceRows,
    ((projectionOccurrences ?? []) as DashboardOccurrence[]).filter(
      (occurrence) => occurrence.due_date <= calendarFrame.visibleEnd
    ),
    weekStartsOn,
    adjustedCurrentBalanceMinor,
    null
  );
  const calendar = fillCalendarCounts(
    calendarFrame,
    calendarOccurrenceRows
  );
  const nextCalendarFrame = buildCalendarFrame(calendarFrame.nextMonth, weekStartsOn);
  const nextMonthPrefetchEnd =
    expandCalendarFrameBounds(nextCalendarFrame).visibleEnd;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <DashboardPrefetch visibleEnd={nextMonthPrefetchEnd} />
      <div className="mx-auto grid w-full max-w-[108rem] gap-5">
        <header className="border-b border-line pb-4">
          <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
              <p className="text-sm font-medium text-gray-700">
                {calendarFrame.label}
              </p>
            </div>
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded border border-line bg-white px-3 text-sm font-semibold text-ink"
              href={buildNewEventHref(selectedMonth, selectedDay, selectedView)}
            >
              New event
            </Link>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(36rem,42rem)] xl:items-start">
          <section className="order-1 grid gap-4 xl:col-start-1 xl:row-start-1">
            <section className="grid gap-4 rounded border border-line bg-white p-4 lg:grid-cols-[minmax(18rem,1.25fr)_repeat(3,minmax(0,1fr))] lg:items-end">
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
              <div className="grid min-w-0 gap-1 rounded border border-line bg-paper p-3">
                <p className="text-sm text-gray-700">Available balance</p>
                <p className="truncate text-lg font-semibold text-ink sm:text-xl">
                  {adjustedCurrentBalanceMinor === null
                    ? "Not set"
                    : formatMinorAmount(
                        adjustedCurrentBalanceMinor,
                        defaultCurrencyCode
                      )}
                </p>
                <p className="truncate text-xs text-gray-700">
                  {balanceAnchorRecordedAt
                    ? `Updated ${formatTimestampLabel(balanceAnchorRecordedAt)}`
                    : "Set balance to start projections"}
                </p>
              </div>
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

          </section>

          <aside className="order-2 grid gap-4 xl:sticky xl:top-4 xl:col-start-2 xl:row-span-2 xl:row-start-1">
            <CalendarNavigation
              calendar={calendar}
              selectedDay={selectedDay}
              selectedMonth={selectedMonth}
              themeToken={themeToken}
              today={today}
              view={selectedView}
            />
            <DayEventsPanel
              accountById={accountById}
              date={dayPanelDate}
              occurrences={dayPanelOccurrenceRows}
              returnTo={buildDashboardHref(
                selectedMonth,
                selectedDay ?? undefined,
                selectedView
              )}
              selectedDay={Boolean(selectedDay)}
              today={today}
            />
          </aside>

          <section className="order-3 grid gap-4 xl:col-start-1 xl:row-start-2">
              <section className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">Upcoming</h2>
                    <p className="text-sm text-gray-700">{calendarFrame.label}</p>
                  </div>
                </div>

                {error ? (
                  <p className="rounded border border-danger/30 bg-white p-4 text-sm text-danger">
                    Unable to load activity right now.
                  </p>
                ) : null}

                {!error && calendarOccurrenceRows.length === 0 ? (
                  <div className="rounded border border-line bg-white p-5">
                    <p className="font-medium text-ink">
                      No activity in this calendar view.
                    </p>
                    <p className="mt-1 text-sm leading-6 text-gray-700">
                      Create a plan or move to another month to find scheduled activity.
                    </p>
                    <Link
                      className="mt-4 inline-flex min-h-11 items-center rounded bg-mint px-4 text-sm font-semibold text-white"
                      href={buildNewEventHref(
                        selectedMonth,
                        selectedDay,
                        selectedView
                      )}
                    >
                      New
                    </Link>
                  </div>
                ) : null}

                <div className="grid gap-4">
                  {weeklyGroups.map((week) => (
                    <section
                      className="grid gap-3 rounded border border-line bg-white p-4 shadow-sm shadow-black/5"
                      key={`${week.weekStart}-${week.weekEnd}`}
                    >
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                        <div>
                          <h3 className="font-semibold text-ink">
                            Week ending {formatShortDate(week.weekEnd)}
                          </h3>
                          <p className="text-xs text-gray-700 sm:text-sm">
                            {formatWeekRange(week.weekStart, week.weekEnd)} ·{" "}
                            {week.occurrences.length} scheduled{" "}
                            {week.occurrences.length === 1 ? "event" : "events"}
                          </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[auto_auto] sm:items-center">
                          <div className="rounded border border-line bg-paper px-3 py-2 sm:text-right">
                            <p className="text-xs font-medium text-gray-700">
                              Net change
                            </p>
                            <p className="whitespace-nowrap text-sm font-semibold text-ink">
                              {formatDelta(
                                week.projectedDeltaMinor,
                                defaultCurrencyCode
                              )}
                            </p>
                          </div>
                          <div className="rounded border border-mint/30 bg-mint/10 px-3 py-2 sm:text-right">
                            <p className="text-xs font-semibold text-mint">
                              Week-ending projected balance
                            </p>
                            <p className="whitespace-nowrap text-lg font-semibold text-ink">
                              {week.endingBalanceMinor === null
                                ? "Set balance"
                                : formatMinorAmount(
                                    week.endingBalanceMinor,
                                    defaultCurrencyCode
                                  )}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        {week.occurrences.map((occurrence) => {
                  const amountLabel =
                    occurrence.amount_status === "unknown"
                      ? "Unknown"
                      : formatMinorAmount(
                          occurrence.expected_amount_minor ?? 0,
                          occurrence.currency_code
                        );
                  const account = occurrence.financial_items?.counterparty_id
                    ? accountById.get(occurrence.financial_items.counterparty_id)
                    : null;
                  const returnTo = buildDashboardHref(
                    selectedMonth,
                    selectedDay ?? undefined,
                    selectedView
                  );
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
                              <Link
                                aria-label={`Edit ${occurrence.financial_items?.name ?? "event"}`}
                                className="grid min-w-0 grid-cols-[3.25rem_minmax(0,1fr)_minmax(4.75rem,auto)] items-center gap-2 rounded border border-line bg-paper p-2.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(7rem,auto)] sm:gap-3 sm:p-3"
                                href={buildEditEventHref(occurrence.id, returnTo)}
                                style={entryAccentStyle(
                                  occurrence.financial_items?.color_token,
                                  themeToken
                                )}
                              >
                                <div className="grid h-11 w-11 shrink-0 place-items-center rounded border border-line bg-white sm:h-12 sm:w-12">
                                  <span className="text-[0.6875rem] font-semibold uppercase leading-none text-gray-700">
                                    {formatWeekday(occurrence.due_date)}
                                  </span>
                                  <span className="text-base font-semibold leading-none text-ink">
                                    {formatDayOfMonth(occurrence.due_date)}
                                  </span>
                                </div>
                                <div className="grid min-w-0 gap-1">
                                  <h3 className="truncate font-semibold text-ink">
                                    {occurrence.financial_items?.name ?? "Untitled"}
                                  </h3>
                                  <p className="truncate text-xs text-gray-700 sm:text-sm">
                                    {[
                                      account?.name,
                                      occurrence.financial_items?.kind ?? "item"
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                </div>
                                <div className="grid min-w-0 justify-items-end gap-1 text-right">
                                  <p className="whitespace-nowrap text-sm font-semibold text-ink sm:text-base">
                                    {amountLabel}
                                  </p>
                                  <div className="grid justify-items-end gap-1 sm:flex sm:justify-end">
                                    <span className="rounded border border-line bg-white px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase text-gray-700 sm:px-2 sm:text-[0.6875rem]">
                                      {occurrence.amount_status}
                                    </span>
                                    {isOverdue(occurrence, today) ? (
                                      <span className="rounded border border-danger/30 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase text-danger sm:px-2 sm:text-[0.6875rem]">
                                        Overdue
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </Link>
                            </SwipeableEventCard>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
          </section>
        </div>
      </div>
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
    borderLeft: `4px solid ${color.background}`
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

function DayEventsPanel({
  accountById,
  date,
  occurrences,
  returnTo,
  selectedDay,
  today
}: {
  accountById: Map<string, { name: string }>;
  date: string;
  occurrences: DashboardOccurrence[];
  returnTo: Route;
  selectedDay: boolean;
  today: string;
}) {
  return (
    <section className="grid gap-3 rounded border border-line bg-white p-4 lg:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">{formatSelectedDayLabel(date)}</h2>
          <p className="text-sm text-gray-700">
            {selectedDay ? "Selected day" : "Today"}
          </p>
        </div>
        <p className="rounded border border-line bg-paper px-2 py-1 text-xs font-semibold text-gray-700">
          {occurrences.length} {occurrences.length === 1 ? "event" : "events"}
        </p>
      </div>

      <div className="grid gap-2">
        {occurrences.length === 0 ? (
          <p className="rounded border border-line bg-paper p-3 text-sm text-gray-700">
            No events scheduled for this day.
          </p>
        ) : null}

        {occurrences.map((occurrence) => {
          const account = occurrence.financial_items?.counterparty_id
            ? accountById.get(occurrence.financial_items.counterparty_id)
            : null;
          const amountLabel =
            occurrence.amount_status === "unknown"
              ? "Unknown"
              : formatMinorAmount(
                  occurrence.expected_amount_minor ?? 0,
                  occurrence.currency_code
                );

          return (
            <Link
              className="grid gap-1 rounded border border-line bg-paper p-3 transition-colors hover:border-mint/50"
              href={buildEditEventHref(occurrence.id, returnTo)}
              key={occurrence.id}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">
                    {occurrence.financial_items?.name ?? "Untitled"}
                  </p>
                  <p className="truncate text-sm text-gray-700">
                    {[
                      account?.name,
                      occurrence.financial_items?.kind ?? "item"
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p className="whitespace-nowrap text-sm font-semibold text-ink">
                  {amountLabel}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                <span className="rounded border border-line bg-white px-2 py-0.5 text-[0.6875rem] font-semibold uppercase text-gray-700">
                  {occurrence.amount_status}
                </span>
                {isOverdue(occurrence, today) ? (
                  <span className="rounded border border-danger/30 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase text-danger">
                    Overdue
                  </span>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>

      <Link
        className="justify-self-center text-sm font-semibold text-mint"
        href={buildDashboardHref(date.slice(0, 7), date, "calendar")}
      >
        View day on calendar
      </Link>
    </section>
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
  const sortedProjectionOccurrences = [...projectionOccurrences].sort((first, second) =>
    first.due_date.localeCompare(second.due_date)
  );

  return Array.from(grouped.values())
    .sort((first, second) => first.weekStart.localeCompare(second.weekStart))
    .map((group) => {
      const balanceTargetDate = selectedDay ?? group.weekEnd;

      while (
        runningProjectionMinor !== null &&
        projectionIndex < sortedProjectionOccurrences.length &&
        sortedProjectionOccurrences[projectionIndex]!.due_date <= balanceTargetDate
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

function formatWeekday(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short"
  }).format(parseDateOnly(date));
}

function formatDayOfMonth(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
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

function expandCalendarFrameBounds(calendarFrame: ReturnType<typeof buildCalendarFrame>) {
  return {
    visibleEnd: formatDateOnly(addUtcDays(parseDateOnly(calendarFrame.visibleEnd), 6)),
    visibleStart: formatDateOnly(addUtcDays(parseDateOnly(calendarFrame.visibleStart), -6))
  };
}

function fillCalendarCounts(
  calendar: ReturnType<typeof buildCalendarFrame>,
  occurrences: DashboardOccurrence[]
) {
  const occurrencesByDate = occurrences.reduce<
    Record<
      string,
      Array<{
        amountLabel: string;
        colorToken: string;
        title: string;
      }>
    >
  >(
    (eventsByDate, occurrence) => {
      eventsByDate[occurrence.due_date] = [
        ...(eventsByDate[occurrence.due_date] ?? []),
        {
          amountLabel:
            occurrence.amount_status === "unknown" ||
            occurrence.expected_amount_minor === null
              ? "Unknown"
              : formatMinorAmount(
                  occurrence.expected_amount_minor,
                  occurrence.currency_code
                ),
          colorToken: occurrence.financial_items?.color_token ?? "",
          title: occurrence.financial_items?.name ?? "Untitled"
        }
      ];
      return eventsByDate;
    },
    {}
  );

  return {
    ...calendar,
    days: calendar.days.map((day) => ({
      ...day,
      colorTokens:
        occurrencesByDate[day.date]?.map((event) => event.colorToken) ?? [],
      events: occurrencesByDate[day.date] ?? []
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

function buildDashboardHref(
  month: string,
  day?: string,
  view: "calendar" | "list" = "list"
) {
  const params = new URLSearchParams({ month });

  if (day) {
    params.set("day", day);
  }
  if (view === "calendar") {
    params.set("view", view);
  }

  return `/dashboard?${params.toString()}` as Route;
}

function buildNewEventHref(
  month: string,
  day: string | null,
  view: "calendar" | "list" = "list"
) {
  return `/events/new?returnTo=${encodeURIComponent(
    buildDashboardHref(month, day ?? undefined, view)
  )}` as Route;
}

function buildEditEventHref(id: string, returnTo: Route) {
  return `/events/${id}/edit?returnTo=${encodeURIComponent(returnTo)}` as Route;
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
