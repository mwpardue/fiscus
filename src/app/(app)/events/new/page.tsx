import { redirect } from "next/navigation";
import { EntryForm } from "@/app/(app)/entries/new/entry-form";
import { DEFAULT_THEME_TOKEN } from "@/lib/color-tags";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function NewEventPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: accounts }] = await Promise.all([
    supabase
      .from("profiles")
      .select("default_currency_code,theme_token")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("counterparties")
      .select("id,name")
      .order("name", { ascending: true })
  ]);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-2xl gap-6">
        <header className="grid gap-3 border-b border-line pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-mint">
              New event
            </p>
            <h1 className="text-2xl font-semibold text-ink">New event</h1>
          </div>
        </header>

        <section className="mobile-action-surface rounded border border-line bg-white p-4 sm:p-5">
          <EntryForm
            accounts={accounts ?? []}
            defaultCurrencyCode={profile?.default_currency_code ?? "USD"}
            themeToken={profile?.theme_token ?? DEFAULT_THEME_TOKEN}
          />
        </section>
      </div>
    </main>
  );
}
