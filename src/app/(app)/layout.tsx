import { DEFAULT_THEME_TOKEN } from "@/lib/color-tags";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppNavigation } from "./app-navigation";

export default async function AppLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("theme_token")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const themeToken = profile?.theme_token ?? DEFAULT_THEME_TOKEN;
  const shellTheme =
    themeToken === "alteraest-dark" ? "alteraest-dark" : "alteraest-light";
  const email = user?.email ?? "Account";
  const initial = email.slice(0, 1).toUpperCase();

  return (
    <div className="app-shell" data-theme={shellTheme}>
      <AppNavigation email={email} initial={initial}>
        {children}
      </AppNavigation>
    </div>
  );
}
