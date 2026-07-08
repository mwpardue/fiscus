import { createServerSupabaseClient } from "@/lib/supabase/server";

const RATE_LIMITS = {
  accountMutation: {
    action: "account_mutation",
    limit: 30,
    message: "Too many account changes. Wait a minute and try again.",
    windowSeconds: 60
  },
  authEmail: {
    action: "auth_email",
    limit: 6,
    message: "Too many sign-in attempts. Wait a few minutes and try again.",
    windowSeconds: 5 * 60
  },
  eventMutation: {
    action: "event_mutation",
    limit: 60,
    message: "Too many event changes. Wait a minute and try again.",
    windowSeconds: 60
  },
  planMutation: {
    action: "plan_mutation",
    limit: 40,
    message: "Too many plan changes. Wait a minute and try again.",
    windowSeconds: 60
  },
  profileMutation: {
    action: "profile_mutation",
    limit: 30,
    message: "Too many settings changes. Wait a minute and try again.",
    windowSeconds: 60
  }
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

export async function enforceRateLimit(
  name: RateLimitName,
  identifier: string
) {
  const config = RATE_LIMITS[name];
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_action: config.action,
    p_identifier: identifier,
    p_limit: config.limit,
    p_window_seconds: config.windowSeconds
  });

  if (error) {
    throw new Error("Unable to check request limits.");
  }

  if (!data) {
    throw new Error(config.message);
  }
}
