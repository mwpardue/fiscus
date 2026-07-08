import { notFound, redirect } from "next/navigation";
import { EntityIcon } from "@/app/(app)/entity-icon";
import { DEFAULT_THEME_TOKEN } from "@/lib/color-tags";
import { resolveEntityIcons } from "@/lib/entity-icons";
import { formatMinorAmountForInput } from "@/lib/money";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { updateEntryAction } from "../../actions";
import { ColorTagPicker } from "../../color-tag-picker";

export default async function EditEntryPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: entry } = await supabase
    .from("financial_items")
    .select("id,name,kind,currency_code,default_amount_status,default_expected_amount_minor,color_token,category_id,counterparty_id,icon_storage_path,brandfetch_icon_url")
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();

  if (!entry) {
    notFound();
  }

  const [
    { data: category },
    { data: counterparty },
    { data: occurrences },
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
      .from("occurrences")
      .select("id,due_date,amount_status,expected_amount_minor,currency_code,lifecycle_status")
      .eq("financial_item_id", entry.id)
      .eq("lifecycle_status", "upcoming")
      .is("archived_at", null)
      .gte("due_date", today)
      .order("due_date", { ascending: true }),
    supabase
      .from("profiles")
      .select("theme_token")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);
  const themeToken = profile?.theme_token ?? DEFAULT_THEME_TOKEN;
  const [planIcon] = await resolveEntityIcons(supabase, [
    {
      accountBrandfetchIconUrl: counterparty?.brandfetch_icon_url ?? null,
      accountIconPath: counterparty?.icon_storage_path ?? null,
      planBrandfetchIconUrl: entry.brandfetch_icon_url,
      planIconPath: entry.icon_storage_path,
      title: entry.name
    }
  ]);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-2xl gap-6">
        <header className="grid gap-3 border-b border-line pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-mint">
              Edit plan
            </p>
            <h1 className="text-2xl font-semibold text-ink">Edit plan</h1>
          </div>
        </header>

        <section className="mobile-action-surface rounded border border-line bg-white p-4 sm:p-5">
          <form action={updateEntryAction} className="grid gap-5">
            <input name="id" type="hidden" value={entry.id} />
            <fieldset className="grid gap-3">
              <legend className="text-sm font-semibold text-ink">Type</legend>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
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

            <div className="flex items-center gap-3 rounded border border-line bg-paper p-3">
              <EntityIcon icon={planIcon} />
              <div>
                <p className="text-sm font-semibold text-ink">
                  {entry.name}
                </p>
                <p className="text-sm text-gray-700">
                  {counterparty?.name ? `${counterparty.name} account` : "No account set"}
                </p>
              </div>
            </div>
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
            <label className="grid gap-2 text-sm font-medium text-ink">
              Account
              <input
                className="min-h-12 rounded border border-line bg-white px-3 text-base"
                name="counterpartyName"
                defaultValue={counterparty?.name ?? ""}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-ink">
              Account icon
              <input
                accept="image/png,image/jpeg,image/webp"
                className="min-h-12 rounded border border-line bg-white px-3 py-2 text-base"
                name="accountIcon"
                type="file"
              />
              <span className="text-xs text-gray-700">
                If no image is uploaded, the app will try to find a logo and then use initials.
              </span>
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink">
              Plan icon override
              <input
                accept="image/png,image/jpeg,image/webp"
                className="min-h-12 rounded border border-line bg-white px-3 py-2 text-base"
                name="planIcon"
                type="file"
              />
              <span className="text-xs text-gray-700">
                Leave blank to inherit the account icon.
              </span>
            </label>
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

          <div className="grid gap-4">
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
          </div>

          <label className="flex items-start gap-3 rounded border border-line bg-paper p-3 text-sm font-medium text-ink">
            <input
              className="mt-1"
              name="updateFutureAmounts"
              type="checkbox"
              value="on"
            />
            <span>
              Update all future unpaid events with this default amount
            </span>
          </label>

          {(occurrences ?? []).length > 0 ? (
            <section className="grid gap-3 rounded border border-line bg-paper p-4">
              <div>
                <h2 className="text-sm font-semibold text-ink">
                  Future event dates
                </h2>
                <p className="mt-1 text-sm text-gray-700">
                  These changes apply only to upcoming events.
                </p>
              </div>
              <div className="grid gap-2">
                {(occurrences ?? []).map((occurrence, index) => (
                  <label
                    className="grid gap-2 rounded border border-line bg-white p-3 text-sm font-medium text-ink sm:grid-cols-[auto_1fr_auto] sm:items-center"
                    key={occurrence.id}
                  >
                    <span>#{index + 1}</span>
                    <span>
                      {occurrence.amount_status === "unknown"
                        ? "Unknown"
                        : formatMinorAmountForInput(
                            occurrence.expected_amount_minor ?? 0
                          )}{" "}
                      {occurrence.currency_code}
                    </span>
                    <input
                      name={`occurrenceDueDate:${occurrence.id}`}
                      type="date"
                      defaultValue={occurrence.due_date}
                      className="min-h-11 rounded border border-line bg-white px-3 text-base"
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
        </section>
      </div>
    </main>
  );
}
