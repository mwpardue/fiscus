import { redirect } from "next/navigation";
import { APP_THEMES, DEFAULT_THEME_TOKEN } from "@/lib/color-tags";
import {
  createServerSupabaseClient,
  getRequestUser
} from "@/lib/supabase/server";
import {
  restoreBackupAction,
  updateThemeAction,
  updateWeekStartAction
} from "./actions";

export const runtime = "edge";

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const user = await getRequestUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("theme_token,week_starts_on")
    .eq("user_id", user.id)
    .maybeSingle();
  const themeToken = profile?.theme_token ?? DEFAULT_THEME_TOKEN;
  const weekStartsOn = profile?.week_starts_on ?? 0;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-2xl gap-6">
        <header className="grid gap-3 border-b border-line pb-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Settings</h1>
            <p className="mt-1 text-sm text-gray-700">
              Profile preferences for display and calendar behavior.
            </p>
          </div>
        </header>

        <section className="grid gap-4 rounded border border-line bg-white p-4 sm:p-5">
          <form action={updateThemeAction} className="grid gap-3">
            <label className="grid gap-2 text-sm font-medium text-ink">
              Theme
              <select
                className="min-h-12 rounded border border-line bg-white px-3 text-base"
                name="themeToken"
                defaultValue={themeToken}
              >
                {APP_THEMES.map((theme) => (
                  <option key={theme.token} value={theme.token}>
                    {theme.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="min-h-11 rounded bg-mint px-4 text-sm font-semibold text-white sm:max-w-40">
              Save theme
            </button>
          </form>

          <form
            action={updateWeekStartAction}
            className="grid gap-3 border-t border-line pt-4"
          >
            <label className="grid gap-2 text-sm font-medium text-ink">
              Week starts on
              <select
                className="min-h-12 rounded border border-line bg-white px-3 text-base"
                name="weekStartsOn"
                defaultValue={String(weekStartsOn)}
              >
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>
            </label>
            <button className="min-h-11 rounded bg-mint px-4 text-sm font-semibold text-white sm:max-w-40">
              Save week start
            </button>
          </form>

          <form action="/logout" className="border-t border-line pt-4" method="post">
            <button className="min-h-11 rounded border border-line bg-white px-4 text-sm font-semibold">
              Log out
            </button>
          </form>
        </section>

        <section className="grid gap-4 rounded border border-line bg-white p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Backup and restore</h2>
            <p className="mt-1 text-sm leading-6 text-gray-700">
              Export a local JSON backup of your accounts, plans, events,
              payments, profile preferences, and audit history.
            </p>
          </div>

          <div className="grid gap-3 border-t border-line pt-4">
            <a
              className="inline-flex min-h-11 items-center justify-center rounded bg-mint px-4 text-sm font-semibold text-white sm:max-w-44"
              href="/settings/backup"
            >
              Download backup
            </a>
          </div>

          <form
            action={restoreBackupAction}
            className="grid gap-3 border-t border-line pt-4"
          >
            <label className="grid gap-2 text-sm font-medium text-ink">
              Restore backup
              <input
                accept="application/json,.json"
                className="min-h-12 rounded border border-line bg-white px-3 py-2 text-sm"
                name="backupFile"
                required
                type="file"
              />
            </label>
            <p className="text-sm leading-6 text-gray-700">
              Restoring replaces your current app data with the contents of the
              selected backup file.
            </p>
            <button className="min-h-11 rounded border border-danger/30 bg-white px-4 text-sm font-semibold text-danger sm:max-w-44">
              Restore backup
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
