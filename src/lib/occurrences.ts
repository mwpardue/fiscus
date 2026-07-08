import type { Tables } from "./database.types";

export type DashboardOccurrence = Pick<
  Tables<"occurrences">,
  | "amount_status"
  | "currency_code"
  | "due_date"
  | "expected_amount_minor"
  | "id"
  | "lifecycle_status"
> & {
  financial_items: Pick<
    Tables<"financial_items">,
    | "brandfetch_icon_url"
    | "color_token"
    | "counterparty_id"
    | "icon_storage_path"
    | "kind"
    | "name"
  > | null;
};

export function isOverdue(
  occurrence: Pick<Tables<"occurrences">, "due_date" | "lifecycle_status">,
  today: string
) {
  return occurrence.lifecycle_status === "upcoming" && occurrence.due_date < today;
}

export function summarizeOccurrences(occurrences: DashboardOccurrence[]) {
  return occurrences.reduce(
    (summary, occurrence) => {
      summary.totalCount += 1;

      if (
        occurrence.lifecycle_status === "skipped" ||
        occurrence.amount_status === "unknown" ||
        occurrence.expected_amount_minor === null
      ) {
        if (occurrence.amount_status === "unknown") {
          summary.unknownCount += 1;
        }
        return summary;
      }

      if (occurrence.financial_items?.kind === "income") {
        summary.incomingMinor += occurrence.expected_amount_minor;
      } else {
        summary.outgoingMinor += occurrence.expected_amount_minor;
      }

      return summary;
    },
    {
      incomingMinor: 0,
      outgoingMinor: 0,
      totalCount: 0,
      unknownCount: 0
    }
  );
}
