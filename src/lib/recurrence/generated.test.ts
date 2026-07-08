import { describe, expect, it } from "vitest";
import { describeGeneratedSchedule, generateDueDates } from "./generated";

describe("generateDueDates", () => {
  it("generates finite daily interval dates", () => {
    expect(
      generateDueDates({
        anchorDate: "2026-07-06",
        count: 4,
        intervalCount: 3,
        intervalUnit: "day"
      })
    ).toEqual(["2026-07-06", "2026-07-09", "2026-07-12", "2026-07-15"]);
  });

  it("generates finite weekly dates", () => {
    expect(
      generateDueDates({
        anchorDate: "2026-07-06",
        count: 4,
        intervalCount: 2,
        intervalUnit: "week"
      })
    ).toEqual(["2026-07-06", "2026-07-20", "2026-08-03", "2026-08-17"]);
  });

  it("generates weekly dates from a selected weekday", () => {
    expect(
      generateDueDates({
        anchorDate: "2026-07-01",
        count: 4,
        intervalCount: 3,
        intervalUnit: "week",
        scheduleBasis: "weekday",
        weekday: 1
      })
    ).toEqual(["2026-07-06", "2026-07-27", "2026-08-17", "2026-09-07"]);
  });

  it("generates monthly ordinal weekday dates", () => {
    expect(
      generateDueDates({
        anchorDate: "2026-07-01",
        count: 4,
        intervalUnit: "month",
        ordinalWeek: -1,
        scheduleBasis: "month_weekday",
        weekday: 2
      })
    ).toEqual(["2026-07-28", "2026-08-25", "2026-09-29", "2026-10-27"]);
  });

  it("generates finite monthly dates with short-month behavior", () => {
    expect(
      generateDueDates({
        anchorDate: "2026-01-31",
        count: 4,
        intervalUnit: "month",
        shortMonthBehavior: "last_day"
      })
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("generates yearly dates with short-year behavior", () => {
    expect(
      generateDueDates({
        anchorDate: "2028-02-29",
        count: 4,
        intervalUnit: "year",
        shortMonthBehavior: "last_day"
      })
    ).toEqual(["2028-02-29", "2029-02-28", "2030-02-28", "2031-02-28"]);
  });

  it("can skip non-leap years for yearly leap-day schedules", () => {
    expect(
      generateDueDates({
        anchorDate: "2028-02-29",
        count: 3,
        intervalUnit: "year",
        shortMonthBehavior: "skip"
      })
    ).toEqual(["2028-02-29", "2032-02-29", "2036-02-29"]);
  });

  it("describes generated schedules in plain language", () => {
    expect(
      describeGeneratedSchedule({
        intervalCount: 2,
        intervalUnit: "week",
        mode: "finite"
      })
    ).toBe("Repeats every 2 weeks");

    expect(
      describeGeneratedSchedule({
        intervalCount: 2,
        intervalUnit: "week",
        mode: "ongoing",
        scheduleBasis: "weekday",
        weekday: 2
      })
    ).toBe("Repeats every other Tuesday without an end date");

    expect(
      describeGeneratedSchedule({
        intervalCount: 1,
        intervalUnit: "month",
        mode: "finite",
        ordinalWeek: 1,
        scheduleBasis: "month_weekday",
        weekday: 3
      })
    ).toBe("Repeats every first Wednesday of the month");
  });
});
