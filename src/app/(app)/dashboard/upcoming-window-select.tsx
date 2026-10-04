"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

export const UPCOMING_WINDOW_OPTIONS = [30, 60, 90] as const;

export type UpcomingWindowDays = (typeof UPCOMING_WINDOW_OPTIONS)[number];

export function UpcomingWindowSelect({
  selectedDay,
  selectedMonth,
  windowDays
}: {
  selectedDay: string | null;
  selectedMonth: string;
  windowDays: UpcomingWindowDays;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="grid gap-1 text-sm font-medium text-ink sm:min-w-44">
      View window
      <select
        className="min-h-10 rounded border border-line bg-white px-3 text-sm font-semibold text-ink disabled:opacity-60"
        disabled={isPending}
        value={windowDays}
        onChange={(event) => {
          const params = new URLSearchParams({
            month: selectedMonth,
            window: event.target.value
          });

          if (selectedDay) {
            params.set("day", selectedDay);
          }

          startTransition(() => {
            router.push(`${pathname}?${params.toString()}` as Route, {
              scroll: false
            });
          });
        }}
      >
        {UPCOMING_WINDOW_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option} days
          </option>
        ))}
      </select>
    </label>
  );
}
