import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { getPublicEnv } from "@/lib/env";

const PROTECTED_PATH_PREFIXES = [
  "/accounts",
  "/dashboard",
  "/entries",
  "/events",
  "/occurrences",
  "/settings"
];

export async function updateSession(request: NextRequest) {
  const startedAt = Date.now();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-user-email");
  requestHeaders.delete("x-user-id");

  let response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  const env = getPublicEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: {
              headers: requestHeaders
            }
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isProtectedRoute = PROTECTED_PATH_PREFIXES.some((pathPrefix) =>
    request.nextUrl.pathname.startsWith(pathPrefix)
  );
  console.info("[perf] middleware auth", {
    elapsedMs: Date.now() - startedAt,
    path: request.nextUrl.pathname,
    protected: isProtectedRoute
  });

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    requestHeaders.set("x-user-id", user.id);
    if (user.email) {
      requestHeaders.set("x-user-email", user.email);
    }

    const authenticatedResponse = NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
    response.cookies.getAll().forEach((cookie) => {
      authenticatedResponse.cookies.set(cookie);
    });

    return authenticatedResponse;
  }

  return response;
}
