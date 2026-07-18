import { describe, expect, it } from "vitest";
import { getEarliestSelectedWeekdayOnOrAfter } from "./weekday-anchor";

describe("getEarliestSelectedWeekdayOnOrAfter", () => {
  it("uses an earlier weekday added after a later selected weekday", () => {
    expect(
      formatLocalDate(
        getEarliestSelectedWeekdayOnOrAfter(
          new Date(2026, 6, 19),
          ["5", "4"],
          5
        )
      )
    ).toBe("2026-07-23");
  });

  it("falls back to the provided weekday when no selected weekdays are valid", () => {
    expect(
      formatLocalDate(
        getEarliestSelectedWeekdayOnOrAfter(new Date(2026, 6, 19), [], 5)
      )
    ).toBe("2026-07-24");
  });
});

function formatLocalDate(date: Date) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}
