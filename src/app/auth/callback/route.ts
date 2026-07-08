import { type NextRequest, NextResponse } from "next/server";
import { normalizeAuthRedirect } from "@/lib/auth/redirects";
import { ensureProfile } from "@/lib/profiles";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = normalizeAuthRedirect(url.searchParams.get("next"));

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      await ensureProfile(supabase, user);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
