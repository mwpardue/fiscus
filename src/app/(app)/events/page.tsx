import Link from "next/link";
import { redirect } from "next/navigation";
import { EntityIcon } from "@/app/(app)/entity-icon";
import { SwipeableEventCard } from "@/app/(app)/swipeable-event-card";
import { resolveEntityIcons } from "@/lib/entity-icons";
import { formatMinorAmount, formatMinorAmountForInput } from "@/lib/money";
import {
  createServerSupabaseClient,
  getRequestUser
} from "@/lib/supabase/server";
import {
  archiveOccurrenceAction,
  completeOccurrenceFromCardAction,
  reopenOccurrenceFromCardAction
} from "../occurrences/actions";

type EventRow = {
  amount_status: "fixed" | "estimated" | "unknown";
  currency_code: string;
  due_date: string;
  expected_amount_minor: number | null;
  id: string;
  lifecycle_status: "upcoming" | "paid" | "received" | "skipped";
  financial_items: {
    brandfetch_icon_url: string | null;
    counterparty_id: string | null;
    icon_storage_path: string | null;
    kind: "bill" | "income";
    name: string;
  } | null;
};

export const runtime = "edge";

export default async function EventsPage() {
  const supabase = await createServerSupabaseClient();
  const user = await getRequestUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: events, error }, { data: accounts }] = await Promise.all([
    supabase
      .from("occurrences")
      .select(
        "id,due_date,amount_status,expected_amount_minor,currency_code,lifecycle_status,financial_items(name,kind,counterparty_id,icon_storage_path,brandfetch_icon_url)"
      )
      .is("archived_at", null)
      .order("due_date", { ascending: true }),
    supabase
      .from("counterparties")
      .select("id,name,icon_storage_path,brandfetch_icon_url")
  ]);
  const eventRows = (events ?? []) as EventRow[];
  const accountById = new Map(
    (accounts ?? []).map((account) => [account.id, account])
  );
  const icons = await resolveEntityIcons(
    supabase,
    eventRows.map((event) => {
      const account = event.financial_items?.counterparty_id
        ? accountById.get(event.financial_items.counterparty_id)
        : null;

      return {
        accountBrandfetchIconUrl: account?.brandfetch_icon_url ?? null,
        accountIconPath: account?.icon_storage_path ?? null,
        planBrandfetchIconUrl: event.financial_items?.brandfetch_icon_url ?? null,
        planIconPath: event.financial_items?.icon_storage_path ?? null,
        title: event.financial_items?.name ?? "Untitled"
      };
    })
  );
  const iconByEventId = new Map(
    eventRows.map((event, index) => [event.id, icons[index]])
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Events</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex min-h-11 items-center rounded bg-mint px-4 text-sm font-semibold text-white"
              href="/events/new"
            >
              New
            </Link>
          </div>
        </header>

        {error ? (
          <p className="rounded border border-danger/30 bg-white p-4 text-sm text-danger">
            Unable to load events right now.
          </p>
        ) : null}

        <section className="rounded border border-line bg-white p-4 text-sm leading-6 text-gray-700">
          Ongoing schedules are stored in generated batches. The Dashboard
          extends them as you view future months; this page shows the generated
          events currently stored.
        </section>

        <section className="grid gap-2">
          {eventRows.map((event) => {
            const icon = iconByEventId.get(event.id) ?? {
              alt: `${event.financial_items?.name ?? "Untitled"} icon`,
              brandfetchUrl: null,
              initials: "?",
              signedUrl: null
            };
            const account = event.financial_items?.counterparty_id
              ? accountById.get(event.financial_items.counterparty_id)
              : null;
            const amountLabel =
              event.amount_status === "unknown" ||
              event.expected_amount_minor === null
                ? "Unknown"
                : formatMinorAmount(
                    event.expected_amount_minor,
                    event.currency_code
                  );
            const leadingAction =
              event.lifecycle_status === "upcoming" &&
              event.amount_status !== "unknown" &&
              event.expected_amount_minor !== null
                ? (
                    <form action={completeOccurrenceFromCardAction}>
                      <input name="id" type="hidden" value={event.id} />
                      <input name="returnTo" type="hidden" value="/events" />
                      <input
                        name="completedOn"
                        type="hidden"
                        value={new Date().toISOString().slice(0, 10)}
                      />
                      <input
                        name="amount"
                        type="hidden"
                        value={formatMinorAmountForInput(
                          event.expected_amount_minor
                        )}
                      />
                      <button className="swipe-complete-action" type="submit">
                        {event.financial_items?.kind === "income"
                          ? "Receive"
                          : "Pay"}
                      </button>
                    </form>
                  )
                : event.lifecycle_status === "paid" ||
                    event.lifecycle_status === "received"
                  ? (
                      <form action={reopenOccurrenceFromCardAction}>
                        <input name="id" type="hidden" value={event.id} />
                        <input name="returnTo" type="hidden" value="/events" />
                        <button className="swipe-complete-action" type="submit">
                          Unmark
                        </button>
                      </form>
                    )
                  : null;
            const isOverdue =
              event.lifecycle_status === "upcoming" && event.due_date < today;

            return (
              <SwipeableEventCard
                animateLeadingAction={false}
                key={event.id}
                leadingAction={leadingAction}
                trailingAction={
                  <form action={archiveOccurrenceAction}>
                    <input name="id" type="hidden" value={event.id} />
                    <input name="returnTo" type="hidden" value="/events" />
                    <button className="swipe-delete-action" type="submit">
                      Delete
                    </button>
                  </form>
                }
              >
                <article
                  className="relative grid gap-2 p-3 pr-14 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <Link
                    aria-label={`Edit ${event.financial_items?.name ?? "event"}`}
                    className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded border border-line bg-white text-ink"
                    href={`/events/${event.id}/edit?returnTo=${encodeURIComponent("/events")}`}
                    title="Edit"
                  >
                    <PencilIcon />
                  </Link>
                  <div className="flex min-w-0 gap-3">
                    <EntityIcon icon={icon} size="lg" />
                    <div className="grid min-w-0 content-center gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-gray-700">
                        <span className="rounded border border-line bg-paper px-2 py-1 text-xs font-semibold text-ink">
                          {formatWeekday(event.due_date)}
                        </span>
                        <span>{formatEventDate(event.due_date)}</span>
                        {account ? <span>- {account.name}</span> : null}
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <h2 className="truncate font-semibold text-ink">
                          {event.financial_items?.name ?? "Untitled"}
                        </h2>
                        <span className="rounded border border-line px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase text-gray-700">
                          {event.financial_items?.kind ?? "item"}
                        </span>
                        {isOverdue ? (
                          <span className="rounded border border-danger/30 px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase text-danger">
                            overdue
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-base font-semibold text-ink">
                      {amountLabel}
                    </p>
                  </div>
                </article>
              </SwipeableEventCard>
            );
          })}

          {!error && eventRows.length === 0 ? (
            <div className="rounded border border-line bg-white p-5">
              <p className="font-medium text-ink">No events yet.</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function formatEventDate(date: string) {
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
