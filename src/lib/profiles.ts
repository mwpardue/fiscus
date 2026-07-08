import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export async function ensureProfile(
  supabase: SupabaseClient<Database>,
  user: {
    id: string;
    user_metadata?: {
      default_currency_code?: unknown;
      timezone?: unknown;
    };
  }
) {
  const defaultCurrencyCode =
    typeof user.user_metadata?.default_currency_code === "string"
      ? user.user_metadata.default_currency_code.toUpperCase()
      : "USD";
  const timezone =
    typeof user.user_metadata?.timezone === "string"
      ? user.user_metadata.timezone
      : "UTC";

  return supabase.from("profiles").upsert({
    user_id: user.id,
    default_currency_code: defaultCurrencyCode,
    timezone
  });
}
