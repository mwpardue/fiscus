import { redirect } from "next/navigation";
import { DEFAULT_THEME_TOKEN } from "@/lib/color-tags";
import {
  createServerSupabaseClient,
  getRequestUser
} from "@/lib/supabase/server";
import { createServerTimer } from "@/lib/server-timing";
import { AppNavigation } from "./app-navigation";

export const runtime = "edge";

export default async function AppLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const timer = createServerTimer("app.layout");
  const supabase = await createServerSupabaseClient();
  const user = await getRequestUser();
  timer.mark("auth");

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("theme_token")
    .eq("user_id", user.id)
    .maybeSingle();
  timer.done({ hasProfile: Boolean(profile) });
  const themeToken = profile?.theme_token ?? DEFAULT_THEME_TOKEN;
  const shellTheme =
    themeToken === "alteraest-dark" ? "alteraest-dark" : "alteraest-light";
  const email = user.email ?? "Account";
  const initial = email.slice(0, 1).toUpperCase();

  return (
    <div className="app-shell" data-theme={shellTheme}>
      <AppNavigation email={email} initial={initial}>
        {children}
      </AppNavigation>
    </div>
  );
}
