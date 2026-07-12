"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { useTransition } from "react";
import { getColorTag } from "@/lib/color-tags";
import type { ResolvedEntityIcon } from "@/lib/entity-icons";

type CalendarDay = {
  colorTokens: string[];
  date: string;
  dayOfMonth: number;
  events: Array<{
    amountLabel: string;
    icon?: ResolvedEntityIcon;
    title: string;
  }>;
  inCurrentMonth: boolean;
  label: string;
};

type DashboardCalendar = {
  days: CalendarDay[];
  label: string;
  nextMonth: string;
  previousMonth: string;
  weekdays: string[];
};

export function CalendarNavigation({
  calendar,
  selectedDay,
  selectedMonth,
  themeToken,
  today
}: {
  calendar: DashboardCalendar;
  selectedDay: string | null;
  selectedMonth: string;
  themeToken: string;
  today: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(month: string, day?: string) {
    const params = new URLSearchParams({ month });

    if (day) {
      params.set("day", day);
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}` as Route, {
        scroll: false
      });
    });
  }

  return (
    <section
      aria-busy={isPending}
      className="grid gap-3 rounded border border-line bg-white p-4"
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <button
          aria-label="Previous month"
          className="inline-flex h-10 w-10 items-center justify-center rounded border border-line bg-white text-ink disabled:opacity-60"
          disabled={isPending}
          type="button"
          onClick={() => navigate(calendar.previousMonth)}
        >
          <ChevronLeftIcon />
        </button>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-ink">{calendar.label}</h2>
        </div>
        <button
          aria-label="Next month"
          className="inline-flex h-10 w-10 items-center justify-center rounded border border-line bg-white text-ink disabled:opacity-60"
          disabled={isPending}
          type="button"
          onClick={() => navigate(calendar.nextMonth)}
        >
          <ChevronRightIcon />
        </button>
      </div>
      <div
        aria-label={`${calendar.label} upcoming activity calendar`}
        className="grid grid-cols-7 gap-1"
      >
        {calendar.weekdays.map((weekday) => (
          <div
            className="py-1 text-center text-xs font-semibold uppercase text-gray-600"
            key={weekday}
          >
            {weekday}
          </div>
        ))}
        {calendar.days.map((day) => {
          const isSelected = day.date === selectedDay;
          const isToday = day.date === today;
          const nextDay = isSelected ? undefined : day.date;

          return (
            <button
              aria-current={isToday ? "date" : undefined}
              aria-label={`${day.label}, ${day.colorTokens.length} scheduled events`}
              className={[
                "relative h-16 rounded border p-2 text-left transition-colors disabled:opacity-60",
                getDayButtonClassName({
                  inCurrentMonth: day.inCurrentMonth,
                  isSelected,
                  isToday
                })
              ].join(" ")}
              disabled={isPending}
              key={day.date}
              type="button"
              onClick={() => navigate(day.date.slice(0, 7), nextDay)}
            >
              <div className="flex h-full flex-col justify-between gap-1">
                <span
                  className={[
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold",
                    getDayNumberClassName({
                      inCurrentMonth: day.inCurrentMonth,
                      isToday
                    })
                  ].join(" ")}
                >
                  {day.dayOfMonth}
                </span>
                {day.colorTokens.length > 0 ? (
                  <span
                    aria-hidden="true"
                    className="relative flex h-5 max-w-full items-center justify-end pl-2"
                  >
                    <span className="group flex max-w-full items-center justify-end overflow-hidden">
                      {day.colorTokens.slice(0, 4).map((colorToken, index) => (
                        <span
                          className="-ml-1.5 block h-3.5 w-3.5 rounded-full border border-white shadow-sm first:ml-0"
                          key={`${day.date}-${colorToken}-${index}`}
                          style={calendarDotStyle(colorToken, themeToken)}
                        />
                      ))}
                      <CalendarEventTooltip events={day.events} />
                    </span>
                  </span>
                ) : (
                  <>
                    <span className="sr-only">No scheduled events</span>
                    <span aria-hidden="true" className="block h-5" />
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {selectedDay ? (
        <div className="flex justify-end">
          <button
            className="text-sm font-semibold text-mint disabled:opacity-60"
            disabled={isPending}
            type="button"
            onClick={() => navigate(selectedMonth)}
          >
            Clear day
          </button>
        </div>
      ) : null}
    </section>
  );
}

function CalendarEventTooltip({
  events
}: {
  events: CalendarDay["events"];
}) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.5rem)] z-30 hidden w-64 -translate-x-1/2 rounded border border-line bg-white p-3 text-left shadow-lg sm:group-hover:block">
      <span className="grid gap-2">
        {events.slice(0, 5).map((event, index) => (
          <span
            className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 text-xs"
            key={`${event.title}-${event.amountLabel}-${index}`}
          >
            <CalendarEventIcon icon={event.icon} title={event.title} />
            <span className="truncate font-semibold text-ink">{event.title}</span>
            <span className="font-medium text-gray-700">{event.amountLabel}</span>
          </span>
        ))}
        {events.length > 5 ? (
          <span className="text-xs font-medium text-gray-700">
            +{events.length - 5} more
          </span>
        ) : null}
      </span>
    </span>
  );
}

function CalendarEventIcon({
  icon,
  title
}: {
  icon: ResolvedEntityIcon | undefined;
  title: string;
}) {
  const className =
    "flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-paper text-[0.625rem] font-semibold text-ink";

  if (icon?.signedUrl || icon?.brandfetchUrl) {
    return (
      <span className={className}>
        <img
          alt=""
          className="h-full w-full object-contain p-0.5"
          referrerPolicy="strict-origin-when-cross-origin"
          src={icon.signedUrl ?? icon.brandfetchUrl ?? undefined}
        />
      </span>
    );
  }

  return (
    <span aria-hidden="true" className={className}>
      {icon?.initials ?? getFallbackInitials(title)}
    </span>
  );
}

function getFallbackInitials(title: string) {
  return title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function getDayButtonClassName({
  inCurrentMonth,
  isSelected,
  isToday
}: {
  inCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
}) {
  if (isSelected) {
    return "border-mint bg-mint/10 ring-2 ring-mint/20";
  }

  if (isToday) {
    return "border-mint bg-mint/10";
  }

  return inCurrentMonth
    ? "border-line bg-paper hover:border-mint/50"
    : "border-line bg-white text-gray-500 hover:border-mint/40";
}

function getDayNumberClassName({
  inCurrentMonth,
  isToday
}: {
  inCurrentMonth: boolean;
  isToday: boolean;
}) {
  if (isToday) {
    return "bg-mint text-white";
  }

  return inCurrentMonth ? "text-ink" : "text-gray-500";
}

function calendarDotStyle(
  colorToken: string | null | undefined,
  themeToken: string | null | undefined
) {
  const color = getColorTag(colorToken, themeToken);

  return {
    backgroundColor: color?.background ?? "var(--color-mint)"
  };
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
