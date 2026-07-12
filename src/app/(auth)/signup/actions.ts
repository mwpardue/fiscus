"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSiteUrl } from "@/lib/env";
import { ensureProfile } from "@/lib/profiles";
import { enforceRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const defaultAllowedSignupEmails = [
  "mpardue@alteraest.com",
  "test2@caracarn.anonaddy.com"
];

const signupSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    timezone: z.string().trim().min(1),
    defaultCurrencyCode: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase())
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"]
  });

export type SignupActionState = {
  message?: string;
  status: "idle" | "error" | "success";
};

export async function signupAction(
  _previousState: SignupActionState,
  formData: FormData
): Promise<SignupActionState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    timezone: formData.get("timezone"),
    defaultCurrencyCode: formData.get("defaultCurrencyCode")
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the sign-up form."
    };
  }

  const supabase = await createServerSupabaseClient();
  const { email, password, timezone, defaultCurrencyCode } = parsed.data;

  if (!isSignupEmailAllowed(email)) {
    redirect("/signup/unavailable");
  }

  const rateLimitError = await getRateLimitError(email);

  if (rateLimitError) {
    return rateLimitError;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`,
      data: {
        default_currency_code: defaultCurrencyCode,
        timezone
      }
    }
  });

  if (error) {
    return {
      status: "error",
      message: "Unable to create that account. Check the form and try again."
    };
  }

  if (!data.session || !data.user) {
    return {
      status: "success",
      message: "Check your email to confirm your account, then sign in."
    };
  }

  const { error: profileError } = await ensureProfile(supabase, data.user);

  if (profileError) {
    return { status: "error", message: profileError.message };
  }

  redirect("/dashboard");
}

async function getRateLimitError(email: string) {
  try {
    await enforceRateLimit("authEmail", email);
    return null;
  } catch (error) {
    return {
      status: "error" as const,
      message:
        error instanceof RateLimitExceededError
          ? error.message
          : "Unable to verify account limits. Try again after setup is complete."
    };
  }
}

function isSignupEmailAllowed(email: string) {
  const allowedEmails =
    process.env.FISCUS_ALLOWED_SIGNUP_EMAILS?.split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean) ?? defaultAllowedSignupEmails;

  return allowedEmails.includes(email.toLowerCase());
}
