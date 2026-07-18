export function getEarliestSelectedWeekdayOnOrAfter(
  date: Date,
  weekdays: Array<number | string | null | undefined>,
  fallbackWeekday: number
) {
  const activeWeekdays = weekdays
    .map((weekday) => normalizeWeekday(Number(weekday)))
    .filter((weekday): weekday is number => weekday !== null);
  const candidateWeekdays =
    activeWeekdays.length > 0
      ? Array.from(new Set(activeWeekdays))
      : [normalizeWeekday(fallbackWeekday) ?? 0];

  return candidateWeekdays
    .map((weekday) => nextWeekdayOnOrAfter(date, weekday))
    .sort((left, right) => left.getTime() - right.getTime())[0];
}

function nextWeekdayOnOrAfter(date: Date, weekday: number) {
  const nextDate = new Date(date);
  const dayOffset = (weekday - nextDate.getDay() + 7) % 7;
  nextDate.setDate(nextDate.getDate() + dayOffset);
  return nextDate;
}

function normalizeWeekday(weekday: number) {
  return Number.isInteger(weekday) && weekday >= 0 && weekday <= 6
    ? weekday
    : null;
}
