import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/app/(app)/back-link";
import { EntityIcon } from "@/app/(app)/entity-icon";
import { ColorTagPicker } from "@/app/(app)/entries/color-tag-picker";
import {
  AmountStatusPicker,
  CurrencyAmountField,
  EventFormSection,
  dateFieldControlClass,
  fieldControlClass,
  primaryActionClass
} from "@/app/(app)/entries/event-form-ui";
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
      <div className="mx-auto grid w-full max-w-3xl gap-5">
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

        <section className="grid gap-4">
          <div className="grid min-w-0 gap-4 rounded border border-line bg-paper p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <EntityIcon icon={eventIcon} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-ink">
                  {entry.name}
                </p>
                <p className="text-sm text-gray-700">
                  {entry.kind} · {occurrence.lifecycle_status}
                </p>
              </div>
            </div>
            <div className="grid gap-1 text-sm text-gray-700 sm:text-right">
              <span>{formatWeekday(occurrence.due_date)}</span>
              <span className="font-semibold text-ink">
                {formatDisplayDate(occurrence.due_date)}
              </span>
            </div>
          </div>

          <form action={updateOccurrenceAction}>
            <input name="id" type="hidden" value={occurrence.id} />
            <input name="returnTo" type="hidden" value={returnTo ?? ""} />
            <EventFormSection
              description="These changes apply only to this scheduled event."
              title="Event occurrence"
            >

            <label className="grid gap-2 text-sm font-medium text-ink">
              Due date
              <input
                className={`${dateFieldControlClass} disabled:bg-paper`}
                name="dueDate"
                type="date"
                defaultValue={occurrence.due_date}
                disabled={!isUpcoming}
                required
              />
            </label>

            <AmountStatusPicker
              defaultStatus={occurrence.amount_status}
              disabled={!isUpcoming}
            />

            <CurrencyAmountField
              currencyCode={occurrence.currency_code}
              defaultValue={
                occurrence.expected_amount_minor === null
                  ? ""
                  : formatMinorAmountForInput(occurrence.expected_amount_minor)
              }
              disabled={!isUpcoming}
              label="Expected amount"
              placeholder="0.00"
            />

            <label className="grid gap-2 text-sm font-medium text-ink">
              Notes
              <textarea
                className="min-h-24 w-full min-w-0 rounded border border-line bg-white px-2 py-2 text-sm disabled:bg-paper sm:min-h-28 sm:px-3 sm:text-base"
                name="notes"
                defaultValue={occurrence.notes ?? ""}
                disabled={!isUpcoming}
              />
            </label>

            <button
              className={`${primaryActionClass} sm:justify-self-start`}
              disabled={!isUpcoming}
            >
              Save event
            </button>
            </EventFormSection>
          </form>

          <form action={updateEventPlanAction}>
            <input name="eventId" type="hidden" value={occurrence.id} />
            <input name="id" type="hidden" value={entry.id} />
            <input name="returnTo" type="hidden" value={returnTo ?? ""} />
            <EventFormSection
              description="These changes apply to the plan behind this event."
              title="Details"
            >

            <label className="grid gap-2 text-sm font-medium text-ink">
              Type
              <select
                className={`${fieldControlClass} bg-paper text-gray-700`}
                defaultValue={entry.kind}
                disabled
              >
                <option value="bill">Bill</option>
                <option value="income">Income</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Plan name
              <input
                className={fieldControlClass}
                name="name"
                defaultValue={entry.name}
                required
              />
            </label>

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 sm:gap-4">
              <EventAccountSelector
                accounts={accounts ?? []}
                defaultAccountId={entry.counterparty_id}
              />
              <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
                Category
                <input
                  className={fieldControlClass}
                  name="categoryName"
                  defaultValue={category?.name ?? ""}
                />
              </label>
            </div>

            <ColorTagPicker
              defaultColorToken={entry.color_token}
              themeToken={themeToken}
            />

            <AmountStatusPicker
              defaultStatus={entry.default_amount_status}
              legend="Amount"
            />

            <CurrencyAmountField
              currencyCode={entry.currency_code}
              defaultValue={
                entry.default_expected_amount_minor === null
                  ? ""
                  : formatMinorAmountForInput(entry.default_expected_amount_minor)
              }
              label="Default amount"
            />

            <label className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded border border-line bg-paper p-3 text-sm font-medium text-ink">
              <input
                className="mt-1 h-4 w-4 shrink-0 accent-mint"
                name="updateFutureAmounts"
                type="checkbox"
                value="on"
              />
              <span>Update all future unpaid events with this default amount</span>
            </label>

            {(futureEvents ?? []).length > 0 ? (
              <section className="grid min-w-0 gap-3 rounded border border-mint/20 bg-mint/10 p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                  <h3 className="text-sm font-semibold text-ink">
                    Future event dates
                  </h3>
                  <p className="mt-1 text-sm text-gray-700">
                    These changes apply only to upcoming events.
                  </p>
                  </div>
                  <p className="text-xs font-medium text-gray-700">
                    {(futureEvents ?? []).length} dates
                  </p>
                </div>
                <ol className="grid max-h-96 gap-2 overflow-auto text-sm text-ink sm:grid-cols-2">
                  {(futureEvents ?? []).map((event) => (
                    <li
                      className="grid min-w-0 gap-3 rounded border border-line bg-white px-2 py-2 sm:px-3"
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
                      <span className="grid min-w-0 gap-2">
                        <span className="text-xs font-semibold text-gray-700">
                          Due date
                        </span>
                        <input
                          name={`occurrenceDueDate:${event.id}`}
                          type="date"
                          defaultValue={event.due_date}
                          className={dateFieldControlClass}
                        />
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <button className={`${primaryActionClass} sm:justify-self-start`}>
              Save details
            </button>
            </EventFormSection>
          </form>

          {(recurrenceRules ?? []).length > 0 ? (
            <EventFormSection
              description="Saving a schedule replaces unpaid generated events for that rule. Paid, received, skipped, and deleted events are preserved."
              title="Schedule"
            >
              {(recurrenceRules ?? []).map((rule) => (
                <ScheduleEditor
                  defaultAmount={
                    entry.default_expected_amount_minor === null
                      ? ""
                      : formatMinorAmountForInput(entry.default_expected_amount_minor)
                  }
                  defaultAmountStatus={entry.default_amount_status}
                  eventId={occurrence.id}
                  key={rule.id}
                  returnTo={returnTo}
                  rule={rule}
                />
              ))}
            </EventFormSection>
          ) : null}

          <form action={archiveOccurrenceAction} className="grid min-w-0 gap-3 rounded border border-line bg-paper p-3 sm:p-5">
            <input name="id" type="hidden" value={occurrence.id} />
            <input name="returnTo" type="hidden" value={returnTo ?? ""} />
            <h2 className="text-sm font-semibold text-ink">Delete</h2>
            <button className="min-h-12 rounded border border-danger/30 bg-white px-4 font-semibold text-danger sm:justify-self-start">
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
