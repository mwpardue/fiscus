import { describe, expect, it } from "vitest";
import { buildWeeklyOccurrenceGroups } from "./dashboard-projections";
import type { DashboardOccurrence } from "./occurrences";

function occurrence(
  id: string,
  dueDate: string,
  amountMinor: number,
  kind: "bill" | "income" = "bill"
): DashboardOccurrence {
  return {
    amount_status: "fixed",
    currency_code: "USD",
    due_date: dueDate,
    expected_amount_minor: amountMinor,
    financial_items: {
      brandfetch_icon_url: null,
      color_token: null,
      counterparty_id: null,
      icon_storage_path: null,
      kind,
      name: id
    },
    id,
    lifecycle_status: "upcoming"
  };
}

describe("buildWeeklyOccurrenceGroups", () => {
  it("includes unresolved overdue occurrences in the running projected balance", () => {
    const overdueRent = occurrence("rent", "2026-10-01", 135000);
    const overdueSubscription = occurrence("subscription", "2026-10-01", 1300);
    const nextWeekBill = occurrence("next-week", "2026-10-05", 1200);

    const groups = buildWeeklyOccurrenceGroups(
      [overdueRent, overdueSubscription, nextWeekBill],
      [overdueRent, overdueSubscription, nextWeekBill],
      5,
      341500,
      null
    );

    expect(groups).toEqual([
      expect.objectContaining({
        endingBalanceMinor: 205200,
        projectedDeltaMinor: -136300,
        weekEnd: "2026-10-01",
        weekStart: "2026-09-25"
      }),
      expect.objectContaining({
        endingBalanceMinor: 204000,
        projectedDeltaMinor: -1200,
        weekEnd: "2026-10-08",
        weekStart: "2026-10-02"
      })
    ]);
  });
});
