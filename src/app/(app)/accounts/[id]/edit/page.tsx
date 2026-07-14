import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/app/(app)/back-link";
import { EntityIcon } from "@/app/(app)/entity-icon";
import { resolveEntityIcons } from "@/lib/entity-icons";
import {
  createServerSupabaseClient,
  getRequestUser
} from "@/lib/supabase/server";
import { updateAccountAction } from "../../actions";

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
      </div>
    </main>
  );
}
