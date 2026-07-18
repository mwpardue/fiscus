import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/app/(app)/back-link";
import { EntityIcon } from "@/app/(app)/entity-icon";
import { resolveEntityIcons } from "@/lib/entity-icons";
import { formatMinorAmount } from "@/lib/money";
import {
  createServerSupabaseClient,
  getRequestUser
} from "@/lib/supabase/server";
import { updateAccountAction } from "../../actions";

export const runtime = "edge";

export default async function EditAccountPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const user = await getRequestUser();

  if (!user) {
    redirect("/login");
  }

  const { data: account } = await supabase
    .from("counterparties")
    .select("id,name,website_url,icon_storage_path,brandfetch_icon_url")
    .eq("id", id)
    .maybeSingle();

  if (!account) {
    notFound();
  }

  const { data: plans } = await supabase
    .from("financial_items")
    .select("id,name,kind")
    .eq("counterparty_id", account.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("name", { ascending: true });
  const planById = new Map((plans ?? []).map((plan) => [plan.id, plan]));
  const { data: events } = (plans ?? []).length
    ? await supabase
        .from("occurrences")
        .select(
          "id,financial_item_id,due_date,amount_status,expected_amount_minor,currency_code,lifecycle_status"
        )
        .eq("user_id", user.id)
        .is("archived_at", null)
        .in(
          "financial_item_id",
          (plans ?? []).map((plan) => plan.id)
        )
        .order("due_date", { ascending: true })
    : { data: [] };
  const [icon] = await resolveEntityIcons(supabase, [
    {
      accountBrandfetchIconUrl: account.brandfetch_icon_url,
      accountIconPath: account.icon_storage_path,
      title: account.name
    }
  ]);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-2xl gap-6">
        <header className="grid gap-3 border-b border-line pb-4">
          <div>
            <BackLink fallbackHref="/accounts" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-mint">
              Edit account
            </p>
            <h1 className="text-2xl font-semibold text-ink">Edit account</h1>
          </div>
        </header>

        <section className="mobile-action-surface rounded border border-line bg-white p-4 sm:p-5">
          <form action={updateAccountAction} className="grid gap-5">
            <input name="id" type="hidden" value={account.id} />
            <div className="flex items-center gap-3 rounded border border-line bg-paper p-3">
              <EntityIcon icon={icon} />
              <div>
                <p className="text-sm font-semibold text-ink">{account.name}</p>
                <p className="text-sm text-gray-700">
                  Account details
                </p>
              </div>
            </div>
            <label className="grid gap-2 text-sm font-medium text-ink">
              Account name
              <input
                className="min-h-12 rounded border border-line bg-white px-3 text-base"
                name="name"
                defaultValue={account.name}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink">
              Website
              <input
                className="min-h-12 rounded border border-line bg-white px-3 text-base"
                name="websiteUrl"
                defaultValue={account.website_url ?? ""}
                placeholder="att.com"
                type="text"
              />
            </label>
            <details className="grid gap-3 text-sm text-ink">
              <summary className="w-fit cursor-pointer rounded border border-line bg-white px-3 py-2 text-sm font-semibold">
                Icon options
              </summary>
              <label className="mt-3 grid min-w-0 gap-2 rounded border border-line bg-paper p-3 text-sm font-medium text-ink">
                Account icon
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className="min-h-12 w-full min-w-0 rounded border border-line bg-white px-3 py-2 text-sm"
                  name="accountIcon"
                  type="file"
                />
              </label>
            </details>
            <button className="min-h-12 rounded bg-mint px-4 font-semibold text-white">
              Save account
            </button>
          </form>
        </section>

        <section className="grid gap-3 rounded border border-line bg-white p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-ink">Account events</h2>
            <p className="mt-1 text-sm leading-6 text-gray-700">
              Ongoing schedules are stored in generated batches. The Dashboard
              extends them as you view future months; this list shows the
              generated events currently stored.
            </p>
          </div>

          <div className="grid gap-2">
            {(events ?? []).map((event) => {
              const plan = planById.get(event.financial_item_id);
              const amountLabel =
                event.amount_status === "unknown" ||
                event.expected_amount_minor === null
                  ? "Unknown"
                  : formatMinorAmount(
                      event.expected_amount_minor,
                      event.currency_code
                    );

              return (
                <Link
                  className="grid gap-2 rounded border border-line bg-paper p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  href={`/events/${event.id}/edit?returnTo=${encodeURIComponent(`/accounts/${account.id}/edit`)}`}
                  key={event.id}
                >
                  <span className="grid min-w-0 gap-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-2 text-gray-700">
                      <span className="rounded border border-line bg-white px-2 py-1 text-xs font-semibold text-ink">
                        {formatWeekday(event.due_date)}
                      </span>
                      <span>{formatDisplayDate(event.due_date)}</span>
                      <span className="rounded border border-line px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase">
                        {event.lifecycle_status}
                      </span>
                    </span>
                    <span className="truncate font-semibold text-ink">
                      {plan?.name ?? "Untitled"}
                    </span>
                  </span>
                  <span className="font-semibold text-ink">{amountLabel}</span>
                </Link>
              );
            })}

            {(events ?? []).length === 0 ? (
              <p className="rounded border border-line bg-paper p-3 text-sm text-gray-700">
                No generated events are tied to this account yet.
              </p>
            ) : null}
          </div>
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
