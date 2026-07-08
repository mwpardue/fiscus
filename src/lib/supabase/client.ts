import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { getPublicEnv } from "@/lib/env";

export function createClientSupabaseClient() {
  const env = getPublicEnv();

  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
