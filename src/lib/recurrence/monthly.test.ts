import { describe, expect, it } from "vitest";
import { generateMonthlyDueDates } from "./monthly";

describe("generateMonthlyDueDates", () => {
  it("generates monthly due dates from the anchor date", () => {
    expect(
      generateMonthlyDueDates({ anchorDate: "2026-07-15", count: 4 })
    ).toEqual(["2026-07-15", "2026-08-15", "2026-09-15", "2026-10-15"]);
  });

  it("uses the final valid day by default for short months", () => {
    expect(
      generateMonthlyDueDates({ anchorDate: "2026-01-31", count: 4 })
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("handles leap years with last-day behavior", () => {
    expect(
      generateMonthlyDueDates({ anchorDate: "2028-01-31", count: 3 })
    ).toEqual(["2028-01-31", "2028-02-29", "2028-03-31"]);
  });

  it("can skip months that do not contain the anchor day", () => {
    expect(
      generateMonthlyDueDates({
        anchorDate: "2026-01-31",
        count: 4,
        shortMonthBehavior: "skip"
      })
    ).toEqual(["2026-01-31", "2026-03-31", "2026-05-31", "2026-07-31"]);
  });

  it("can roll overflow days into the next month", () => {
    expect(
      generateMonthlyDueDates({
        anchorDate: "2026-01-31",
        count: 3,
        shortMonthBehavior: "next_month"
      })
    ).toEqual(["2026-01-31", "2026-03-03", "2026-03-31"]);
  });

  it("supports multi-month intervals", () => {
    expect(
      generateMonthlyDueDates({
        anchorDate: "2026-01-15",
        count: 4,
        intervalCount: 3
      })
    ).toEqual(["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]);
  });
});
