import { redirect } from "next/navigation";
import { EntryForm } from "@/app/(app)/entries/new/entry-form";
import { DEFAULT_THEME_TOKEN } from "@/lib/color-tags";
import {
  createServerSupabaseClient,
  getRequestUser
} from "@/lib/supabase/server";

export const runtime = "edge";

export default async function NewEventPage({
  searchParams
}: {
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const params = await searchParams;
  const user = await getRequestUser();

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
    <main className="min-h-screen px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-3xl gap-5">
        <header className="grid gap-2 border-b border-line pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-mint">
              New event
            </p>
            <h1 className="text-2xl font-semibold text-ink">Add event</h1>
          </div>
        </header>

        <EntryForm
          accounts={accounts ?? []}
          defaultCurrencyCode={profile?.default_currency_code ?? "USD"}
          returnTo={params?.returnTo}
          themeToken={profile?.theme_token ?? DEFAULT_THEME_TOKEN}
        />
      </div>
    </main>
  );
}
