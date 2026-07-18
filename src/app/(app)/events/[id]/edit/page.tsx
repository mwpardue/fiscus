import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/app/(app)/back-link";
import { EntityIcon } from "@/app/(app)/entity-icon";
import { ColorTagPicker } from "@/app/(app)/entries/color-tag-picker";
import { DEFAULT_THEME_TOKEN } from "@/lib/color-tags";
import { resolveEntityIcons } from "@/lib/entity-icons";
import { formatMinorAmountForInput } from "@/lib/money";
import {
  createServerSupabaseClient,
  getRequestUser
} from "@/lib/supabase/server";
import {
  archiveOccurrenceAction,
  updateOccurrenceAction
} from "../../../occurrences/actions";
import { updateEventPlanAction } from "../../actions";
import { EventAccountSelector } from "./account-selector";
import { ScheduleEditor } from "./schedule-editor";

export const runtime = "edge";

export default async function EditEventPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const returnTo = search?.returnTo;
  const supabase = await createServerSupabaseClient();
  const user = await getRequestUser();

  if (!user) {
    redirect("/login");
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: occurrence } = await supabase
    .from("occurrences")
    .select(
      "id,financial_item_id,due_date,amount_status,expected_amount_minor,currency_code,lifecycle_status,notes"
    )
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  if (!occurrence) {
    notFound();
  }

  const { data: entry } = await supabase
    .from("financial_items")
    .select("id,name,kind,currency_code,default_amount_status,default_expected_amount_minor,color_token,category_id,counterparty_id,icon_storage_path,brandfetch_icon_url")
    .eq("id", occurrence.financial_item_id)
    .maybeSingle();

  if (!entry) {
    notFound();
  }

  const [
    { data: category },
    { data: account },
    { data: accounts },
    { data: futureEvents },
    { data: recurrenceRules },
    { data: profile }
  ] = await Promise.all([
    entry.category_id
      ? supabase
          .from("categories")
          .select("name")
          .eq("id", entry.category_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    entry.counterparty_id
      ? supabase
          .from("counterparties")
          .select("name,icon_storage_path,brandfetch_icon_url")
          .eq("id", entry.counterparty_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("counterparties")
      .select("id,name")
      .order("name", { ascending: true }),
    supabase
      .from("occurrences")
      .select("id,due_date,amount_status,expected_amount_minor,currency_code,lifecycle_status")
      .eq("financial_item_id", entry.id)
      .eq("lifecycle_status", "upcoming")
      .is("archived_at", null)
      .gte("due_date", today)
      .order("due_date", { ascending: true }),
    supabase
      .from("recurrence_rules")
      .select(
        "id,mode,interval_unit,interval_count,anchor_date,anchor_weekday,ordinal_week,schedule_basis,short_month_behavior,occurrence_count,business_day_adjustment"
      )
      .eq("financial_item_id", entry.id)
      .eq("status", "active")
      .in("mode", ["ongoing", "finite"])
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("theme_token")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);
  const themeToken = profile?.theme_token ?? DEFAULT_THEME_TOKEN;
  const [eventIcon] = await resolveEntityIcons(supabase, [
    {
      accountBrandfetchIconUrl: account?.brandfetch_icon_url ?? null,
      accountIconPath: account?.icon_storage_path ?? null,
      planBrandfetchIconUrl: entry.brandfetch_icon_url,
      planIconPath: entry.icon_storage_path,
      title: entry.name
    }
  ]);
  const isUpcoming = occurrence.lifecycle_status === "upcoming";

  return (
    <main className="min-h-screen overflow-x-hidden px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-2xl gap-6">
        <header className="grid gap-3 border-b border-line pb-4">
          <div>
            <BackLink fallbackHref="/events" href={returnTo} />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-mint">
              Edit event
            </p>
            <h1 className="text-2xl font-semibold text-ink">Edit event</h1>
          </div>
        </header>

        {!isUpcoming ? (
          <p className="rounded border border-danger/30 bg-white p-4 text-sm text-danger">
            Completed and skipped events are locked. Reopen one before editing
            its details.
          </p>
        ) : null}

        <section className="mobile-action-surface grid gap-6 rounded border border-line bg-white p-4 sm:p-5">
          <div className="flex items-center gap-3 rounded border border-line bg-paper p-3">
            <EntityIcon icon={eventIcon} />
            <div>
              <p className="text-sm font-semibold text-ink">{entry.name}</p>
              <p className="text-sm text-gray-700">
                {entry.kind} · {occurrence.lifecycle_status}
              </p>
            </div>
          </div>

          <form action={updateOccurrenceAction} className="grid gap-5">
            <input name="id" type="hidden" value={occurrence.id} />
            <input name="returnTo" type="hidden" value={returnTo ?? ""} />
            <div>
              <h2 className="text-sm font-semibold text-ink">This event</h2>
              <p className="mt-1 text-sm text-gray-700">
                These changes apply only to this scheduled event.
              </p>
            </div>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Due date
              <input
                className="min-h-12 rounded border border-line bg-white px-3 text-base disabled:bg-paper"
                name="dueDate"
                type="date"
                defaultValue={occurrence.due_date}
                disabled={!isUpcoming}
                required
              />
            </label>

            <fieldset className="grid gap-3">
              <legend className="text-sm font-semibold text-ink">
                Amount status
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["fixed", "estimated", "unknown"] as const).map((status) => (
                  <label
                    className="flex min-h-12 items-center rounded border border-line bg-white px-3 text-sm font-medium"
                    key={status}
                  >
                    <input
                      className="mr-2"
                      type="radio"
                      name="amountStatus"
                      value={status}
                      defaultChecked={occurrence.amount_status === status}
                      disabled={!isUpcoming}
                    />
                    {status[0].toUpperCase()}
                    {status.slice(1)}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Expected amount
              <span className="grid min-h-12 grid-cols-[1fr_auto] overflow-hidden rounded border border-line bg-white">
                <input
                  className="min-w-0 border-0 bg-transparent px-3 text-base outline-none disabled:bg-paper"
                  name="expectedAmount"
                  inputMode="decimal"
                  defaultValue={
                    occurrence.expected_amount_minor === null
                      ? ""
                      : formatMinorAmountForInput(
                          occurrence.expected_amount_minor
                        )
                  }
                  placeholder="0.00"
                  disabled={!isUpcoming}
                />
                <span className="flex items-center border-l border-line bg-paper px-3 text-sm font-semibold text-gray-700">
                  {occurrence.currency_code}
                </span>
              </span>
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Notes
              <textarea
                className="min-h-28 rounded border border-line bg-white px-3 py-2 text-base disabled:bg-paper"
                name="notes"
                defaultValue={occurrence.notes ?? ""}
                disabled={!isUpcoming}
              />
            </label>

            <button
              className="min-h-12 rounded bg-mint px-4 font-semibold text-white disabled:opacity-60"
              disabled={!isUpcoming}
            >
              Save event
            </button>
          </form>

          <form action={updateEventPlanAction} className="grid min-w-0 gap-5 border-t border-line pt-5">
            <input name="eventId" type="hidden" value={occurrence.id} />
            <input name="id" type="hidden" value={entry.id} />
            <input name="returnTo" type="hidden" value={returnTo ?? ""} />
            <div>
              <h2 className="text-sm font-semibold text-ink">Whole plan</h2>
              <p className="mt-1 text-sm text-gray-700">
                These changes apply to the plan behind this event.
              </p>
            </div>

            <fieldset className="grid gap-3">
              <legend className="text-sm font-semibold text-ink">Type</legend>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                <label className="flex min-h-12 items-center justify-center rounded border border-line bg-white px-3 text-sm font-semibold text-gray-700">
                  <input
                    className="mr-2"
                    type="radio"
                    defaultChecked={entry.kind === "bill"}
                    disabled
                  />
                  Bill
                </label>
                <label className="flex min-h-12 items-center justify-center rounded border border-line bg-white px-3 text-sm font-semibold text-gray-700">
                  <input
                    className="mr-2"
                    type="radio"
                    defaultChecked={entry.kind === "income"}
                    disabled
                  />
                  Income
                </label>
                <ColorTagPicker
                  defaultColorToken={entry.color_token}
                  themeToken={themeToken}
                />
              </div>
            </fieldset>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Plan name
              <input
                className="min-h-12 rounded border border-line bg-white px-3 text-base"
                name="name"
                defaultValue={entry.name}
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-ink">
                Category
                <input
                  className="min-h-12 rounded border border-line bg-white px-3 text-base"
                  name="categoryName"
                  defaultValue={category?.name ?? ""}
                />
              </label>
              <EventAccountSelector
                accounts={accounts ?? []}
                defaultAccountId={entry.counterparty_id}
              />
            </div>

            <fieldset className="grid gap-3">
              <legend className="text-sm font-semibold text-ink">Amount</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["fixed", "estimated", "unknown"] as const).map((status) => (
                  <label
                    className="flex min-h-12 items-center rounded border border-line bg-white px-3 text-sm font-medium"
                    key={status}
                  >
                    <input
                      className="mr-2"
                      type="radio"
                      name="amountStatus"
                      value={status}
                      defaultChecked={entry.default_amount_status === status}
                    />
                    {status[0].toUpperCase()}
                    {status.slice(1)}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Default amount
              <span className="grid min-h-12 grid-cols-[1fr_auto] overflow-hidden rounded border border-line bg-white">
                <input
                  className="min-w-0 border-0 bg-transparent px-3 text-base outline-none"
                  name="expectedAmount"
                  defaultValue={
                    entry.default_expected_amount_minor === null
                      ? ""
                      : formatMinorAmountForInput(entry.default_expected_amount_minor)
                  }
                  inputMode="decimal"
                  placeholder="125.00"
                />
                <span className="flex items-center border-l border-line bg-paper px-3 text-sm font-semibold text-gray-700">
                  {entry.currency_code}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded border border-line bg-paper p-3 text-sm font-medium text-ink">
              <input
                className="mt-1"
                name="updateFutureAmounts"
                type="checkbox"
                value="on"
              />
              <span>Update all future unpaid events with this default amount</span>
            </label>

            {(futureEvents ?? []).length > 0 ? (
              <section className="grid gap-3 rounded border border-line bg-paper p-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    Future event dates
                  </h3>
                  <p className="mt-1 text-sm text-gray-700">
                    These changes apply only to upcoming events.
                  </p>
                </div>
                <div className="grid gap-2">
                  {(futureEvents ?? []).map((event) => (
                    <label
                      className="grid min-w-0 gap-2 rounded border border-line bg-white p-3 text-sm font-medium text-ink sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      key={event.id}
                    >
                      <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                        <span className="rounded border border-line bg-paper px-2 py-1 text-xs font-semibold text-ink">
                          {formatWeekday(event.due_date)}
                        </span>
                        <span className="grid min-w-0 gap-0.5">
                          <span className="font-semibold">
                            {formatDisplayDate(event.due_date)}
                          </span>
                          <span className="text-xs text-gray-700">
                            {event.amount_status === "unknown"
                              ? "Unknown"
                              : formatMinorAmountForInput(
                                  event.expected_amount_minor ?? 0
                                )}{" "}
                            {event.currency_code}
                          </span>
                        </span>
                      </span>
                      <input
                        name={`occurrenceDueDate:${event.id}`}
                        type="date"
                        defaultValue={event.due_date}
                        className="min-h-11 min-w-0 rounded border border-line bg-white px-3 text-base"
                      />
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            <button className="min-h-12 rounded bg-mint px-4 font-semibold text-white">
              Save plan
            </button>
          </form>

          {(recurrenceRules ?? []).length > 0 ? (
            <section className="grid gap-3 border-t border-line pt-5">
              <div>
                <h2 className="text-sm font-semibold text-ink">Schedule</h2>
                <p className="mt-1 text-sm text-gray-700">
                  Saving a schedule replaces unpaid generated events for that
                  rule. Paid, received, skipped, and deleted events are
                  preserved.
                </p>
              </div>
              {(recurrenceRules ?? []).map((rule) => (
                <ScheduleEditor
                  eventId={occurrence.id}
                  key={rule.id}
                  returnTo={returnTo}
                  rule={rule}
                />
              ))}
            </section>
          ) : null}

          <form action={archiveOccurrenceAction} className="border-t border-line pt-5">
            <input name="id" type="hidden" value={occurrence.id} />
            <input name="returnTo" type="hidden" value={returnTo ?? ""} />
            <button className="min-h-12 rounded border border-danger/30 px-4 font-semibold text-danger">
              Delete event
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function formatDisplayDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  }).format(parseDateOnly(date));
}

function formatWeekday(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short"
  }).format(parseDateOnly(date));
}

function parseDateOnly(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
