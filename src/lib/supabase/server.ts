import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { Database } from "@/lib/database.types";
import { getPublicEnv } from "@/lib/env";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server components cannot set cookies; middleware refreshes sessions.
          }
        }
      }
    }
  );
}

export async function getRequestUser() {
  const headerStore = await headers();
  const id = headerStore.get("x-user-id");

  if (!id) {
    return null;
  }

  return {
    email: headerStore.get("x-user-email"),
    id
  };
}
