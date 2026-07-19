import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { BackLink } from "@/app/(app)/back-link";
import { formatMinorAmount } from "@/lib/money";
import {
  describeGeneratedSchedule,
  type ScheduleBasis
} from "@/lib/recurrence/generated";
import {
  createServerSupabaseClient,
  getRequestUser
} from "@/lib/supabase/server";
import { ArchiveRuleForm } from "./archive-rule-form";

type RuleRow = {
  anchor_date: string | null;
  anchor_day: number | null;
  anchor_weekday: number | null;
  business_day_adjustment:
    | "none"
    | "previous_business_day"
    | "next_business_day";
  converted_from_rule_id: string | null;
  created_at: string;
  ends_on: string | null;
  financial_item_id: string;
  id: string;
  interval_count: number | null;
  interval_unit: "day" | "week" | "month" | "year" | null;
  mode: "ongoing" | "finite" | "manual";
  occurrence_count: number | null;
  ordinal_week: number | null;
  schedule_basis: string;
  short_month_behavior: "last_day" | "next_month" | "skip" | null;
  status: "active" | "superseded" | "archived";
  updated_at: string;
};

type PlanRow = {
  counterparty_id: string | null;
  currency_code: string;
  default_amount_status: "fixed" | "estimated" | "unknown";
  default_expected_amount_minor: number | null;
  id: string;
  kind: "bill" | "income";
  name: string;
  status: "active" | "archived";
};

type OccurrenceSummary = {
  archived_count: number;
  first_due_date: string | null;
  latest_due_date: string | null;
  open_count: number;
  recurrence_rule_id: string;
  total_count: number;
};

export const runtime = "edge";

export default async function RecurrenceRulesPage() {
  const supabase = await createServerSupabaseClient();
  const user = await getRequestUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { data: rules, error },
    { data: plans },
    { data: accounts },
    { data: occurrenceSummaries }
  ] = await Promise.all([
      supabase
        .from("recurrence_rules")
        .select(
          "id,financial_item_id,mode,interval_unit,interval_count,anchor_date,anchor_day,anchor_weekday,ordinal_week,schedule_basis,short_month_behavior,ends_on,occurrence_count,converted_from_rule_id,status,created_at,updated_at,business_day_adjustment"
        )
        .eq("user_id", user.id)
        .order("status", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("financial_items")
        .select(
          "id,name,kind,status,counterparty_id,currency_code,default_amount_status,default_expected_amount_minor"
        )
        .eq("user_id", user.id),
      supabase.from("counterparties").select("id,name").eq("user_id", user.id),
      supabase.rpc("get_recurrence_rule_occurrence_summaries")
    ]);
  const ruleRows = (rules ?? []) as RuleRow[];
  const planById = new Map(
    ((plans ?? []) as PlanRow[]).map((plan) => [plan.id, plan])
  );
  const accountById = new Map(
    (accounts ?? []).map((account) => [account.id, account.name])
  );
  const summaries = summarizeOccurrencesByRule(occurrenceSummaries ?? []);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="grid gap-3 border-b border-line pb-4">
          <div>
            <BackLink fallbackHref="/events" href="/events" />
          </div>
          <div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-mint">
                Events
              </p>
              <h1 className="text-2xl font-semibold text-ink">
                Recurrence rules
              </h1>
            </div>
          </div>
        </header>

        {error ? (
          <p className="rounded border border-danger/30 bg-white p-4 text-sm text-danger">
            Unable to load recurrence rules right now.
          </p>
        ) : null}

        <section className="rounded border border-line bg-white p-4 text-sm leading-6 text-gray-700">
          This is a read-only inventory of schedule rules. Active rules generate
          upcoming events; superseded and archived rules are kept for history.
        </section>

        <section className="grid gap-3">
          {ruleRows.map((rule) => {
            const plan = planById.get(rule.financial_item_id) ?? null;
            const accountName = plan?.counterparty_id
              ? accountById.get(plan.counterparty_id)
              : null;
            const summary = summaries.get(rule.id) ?? {
              archived: 0,
              firstDueDate: null,
              latestDueDate: null,
              open: 0,
              total: 0
            };

            return (
              <article
                className="grid gap-4 rounded border border-line bg-white p-4"
                key={rule.id}
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-ink">
                        {plan?.name ?? "Missing plan"}
                      </h2>
                      <span className="rounded border border-line px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase text-gray-700">
                        {plan?.kind ?? "plan"}
                      </span>
                      <span className={getStatusClass(rule.status)}>
                        {rule.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-700">
                      {accountName ?? "No account"} ·{" "}
                      {formatDefaultAmount(plan)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {rule.status === "active" ? (
                      <ArchiveRuleForm
                        openCount={summary.open}
                        planName={plan?.name ?? "Missing plan"}
                        ruleId={rule.id}
                      />
                    ) : null}
                    <Link
                      className="inline-flex min-h-10 items-center justify-center rounded border border-line bg-paper px-3 text-sm font-semibold text-ink"
                      href={`/events?${new URLSearchParams({
                        ruleId: rule.id
                      }).toString()}` as Route}
                    >
                      Find events
                    </Link>
                  </div>
                </div>

                <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <RuleDetail label="Schedule" value={describeRule(rule)} />
                  <RuleDetail label="Anchor" value={describeAnchor(rule)} />
                  <RuleDetail
                    label="Limits"
                    value={describeTermination(rule)}
                  />
                  <RuleDetail
                    label="Generated events"
                    value={`${summary.open} open / ${summary.total} total`}
                  />
                  <RuleDetail
                    label="Date range"
                    value={
                      summary.firstDueDate && summary.latestDueDate
                        ? `${formatDisplayDate(summary.firstDueDate)} to ${formatDisplayDate(summary.latestDueDate)}`
                        : "No generated events"
                    }
                  />
                  <RuleDetail
                    label="Archived events"
                    value={String(summary.archived)}
                  />
                  <RuleDetail
                    label="Created"
                    value={formatTimestamp(rule.created_at)}
                  />
                  <RuleDetail
                    label="Updated"
                    value={formatTimestamp(rule.updated_at)}
                  />
                </dl>
              </article>
            );
          })}

          {!error && ruleRows.length === 0 ? (
            <div className="rounded border border-line bg-white p-5">
              <p className="font-medium text-ink">No recurrence rules yet.</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function RuleDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded border border-line bg-paper p-3">
      <dt className="text-xs font-semibold uppercase text-gray-700">{label}</dt>
      <dd className="text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function describeRule(rule: RuleRow) {
  if (rule.mode === "manual") {
    return "Manual schedule";
  }

  if (!rule.interval_unit) {
    return "Invalid generated schedule";
  }

  return describeGeneratedSchedule({
    intervalCount: rule.interval_count ?? 1,
    intervalUnit: rule.interval_unit,
    mode: rule.mode,
    ordinalWeek: rule.ordinal_week,
    scheduleBasis: normalizeScheduleBasis(rule.schedule_basis),
    weekday: rule.anchor_weekday
  });
}

function describeAnchor(rule: RuleRow) {
  if (rule.mode === "manual") {
    return "Manual dates";
  }

  const parts = [
    rule.anchor_date ? formatDisplayDate(rule.anchor_date) : null,
    rule.anchor_day ? `day ${rule.anchor_day}` : null,
    rule.anchor_weekday !== null ? formatWeekdayName(rule.anchor_weekday) : null,
    rule.ordinal_week !== null ? formatOrdinalWeek(rule.ordinal_week) : null,
    rule.short_month_behavior
      ? `short months: ${rule.short_month_behavior.replaceAll("_", " ")}`
      : null,
    rule.business_day_adjustment !== "none"
      ? rule.business_day_adjustment.replaceAll("_", " ")
      : null
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "No anchor";
}

function describeTermination(rule: RuleRow) {
  if (rule.mode === "ongoing") {
    return "No end date";
  }

  if (rule.mode === "manual") {
    return "Finite manual schedule";
  }

  if (rule.occurrence_count) {
    return `${rule.occurrence_count} events`;
  }

  return rule.ends_on ? `Ends ${formatDisplayDate(rule.ends_on)}` : "Finite";
}

function formatDefaultAmount(item: PlanRow | null) {
  if (!item) {
    return "No amount";
  }

  if (
    item.default_amount_status === "unknown" ||
    item.default_expected_amount_minor === null
  ) {
    return "Unknown amount";
  }

  return `${formatMinorAmount(
    item.default_expected_amount_minor,
    item.currency_code
  )} ${item.default_amount_status}`;
}

function summarizeOccurrencesByRule(rows: OccurrenceSummary[]) {
  const summaries = new Map<
    string,
    {
      archived: number;
      firstDueDate: string | null;
      latestDueDate: string | null;
      open: number;
      total: number;
    }
  >();

  for (const row of rows) {
    summaries.set(row.recurrence_rule_id, {
      archived: row.archived_count,
      firstDueDate: row.first_due_date,
      latestDueDate: row.latest_due_date,
      open: row.open_count,
      total: row.total_count
    });
  }

  return summaries;
}

function getStatusClass(status: RuleRow["status"]) {
  const base =
    "rounded border px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase";

  if (status === "active") {
    return `${base} border-mint/30 text-mint`;
  }

  if (status === "archived") {
    return `${base} border-danger/30 text-danger`;
  }

  return `${base} border-line text-gray-700`;
}

function normalizeScheduleBasis(value: string): ScheduleBasis {
  if (value === "weekday" || value === "month_weekday") {
    return value;
  }

  return "date";
}

function formatDisplayDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  }).format(parseDateOnly(date));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric"
  }).format(new Date(value));
}

function formatWeekdayName(value: number) {
  return (
    [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ][value] ?? "Unknown weekday"
  );
}

function formatOrdinalWeek(value: number) {
  if (value === -1) {
    return "last week";
  }

  return `week ${value}`;
}

function parseDateOnly(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
