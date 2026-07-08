import Link from "next/link";
import { redirect } from "next/navigation";
import { EntityIcon } from "@/app/(app)/entity-icon";
import { resolveEntityIcons } from "@/lib/entity-icons";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAccountAction } from "./actions";

export default async function AccountsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: accounts, error } = await supabase
    .from("counterparties")
    .select("id,name,icon_storage_path,brandfetch_icon_url,updated_at")
    .order("name", { ascending: true });
  const icons = await resolveEntityIcons(
    supabase,
    (accounts ?? []).map((account) => ({
      accountBrandfetchIconUrl: account.brandfetch_icon_url,
      accountIconPath: account.icon_storage_path,
      title: account.name
    }))
  );
  const iconByAccountId = new Map(
    (accounts ?? []).map((account, index) => [account.id, icons[index]])
  );

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-4xl gap-6">
        <header className="border-b border-line pb-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Accounts</h1>
          </div>
        </header>

        <form
          action={createAccountAction}
          className="grid gap-3 rounded border border-line bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-end"
        >
          <label className="grid gap-2 text-sm font-medium text-ink">
            Account name
            <input
              className="min-h-12 rounded border border-line bg-white px-3 text-base"
              name="name"
              placeholder="Amazon, Duke Energy, employer"
              required
            />
            <span className="text-xs text-gray-700">
              The app will try to find a logo automatically and will use initials if none is found.
            </span>
          </label>
          <button className="min-h-12 rounded bg-mint px-4 font-semibold text-white">
            Add account
          </button>
        </form>

        {error ? (
          <p className="rounded border border-danger/30 bg-white p-4 text-sm text-danger">
            Unable to load accounts right now.
          </p>
        ) : null}

        <section className="grid gap-2">
          {(accounts ?? []).map((account) => {
            const icon = iconByAccountId.get(account.id) ?? {
              alt: `${account.name} icon`,
              brandfetchUrl: null,
              initials: "?",
              signedUrl: null
            };

            return (
              <article
                className="grid gap-3 rounded border border-line bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                key={account.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <EntityIcon icon={icon} />
                  <div className="min-w-0">
                    <h2 className="font-semibold text-ink">{account.name}</h2>
                    <p className="text-sm text-gray-700">
                      Updated {formatDate(account.updated_at)}
                    </p>
                  </div>
                </div>
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded border border-line px-3 text-sm font-semibold"
                  href={`/accounts/${account.id}/edit`}
                >
                  Edit
                </Link>
              </article>
            );
          })}

          {!error && (accounts ?? []).length === 0 ? (
            <div className="rounded border border-line bg-white p-5">
              <p className="font-medium text-ink">No accounts yet.</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function formatDate(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium"
  }).format(new Date(timestamp));
}
