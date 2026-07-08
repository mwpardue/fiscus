"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSiteUrl } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).optional(),
  intent: z.enum(["password", "magic-link"])
});

export type LoginActionState = {
  message?: string;
  status: "idle" | "error" | "success";
};

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password") || undefined,
    intent: formData.get("intent")
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter a valid email address and password."
    };
  }

  const supabase = await createServerSupabaseClient();
  const { email, password, intent } = parsed.data;
  const rateLimitError = await getRateLimitError(email);

  if (rateLimitError) {
    return rateLimitError;
  }

  if (intent === "magic-link") {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`
      }
    });

    if (error) {
      return {
        status: "error",
        message: "Unable to send a sign-in link. Check the email address and try again."
      };
    }

    return {
      status: "success",
      message: "Check your email for a sign-in link."
    };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: password ?? ""
  });

  if (error) {
    return {
      status: "error",
      message: "Unable to sign in with those credentials."
    };
  }

  redirect("/dashboard");
}

async function getRateLimitError(email: string) {
  try {
    await enforceRateLimit("authEmail", email);
    return null;
  } catch {
    return {
      status: "error" as const,
      message: "Too many sign-in attempts. Wait a few minutes and try again."
    };
  }
}
