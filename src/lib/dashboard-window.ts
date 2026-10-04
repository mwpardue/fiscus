export const UPCOMING_WINDOW_OPTIONS = [30, 60, 90] as const;

export type UpcomingWindowDays = (typeof UPCOMING_WINDOW_OPTIONS)[number];
