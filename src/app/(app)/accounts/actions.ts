"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { applyAccountBrandfetchMatch } from "@/lib/financial-item-metadata";
import { uploadEntityIcon } from "@/lib/entity-icons";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const accountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  websiteUrl: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((value) => normalizeWebsiteUrl(value))
});

export async function createAccountAction(formData: FormData) {
  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    websiteUrl: formData.get("websiteUrl") || undefined
  });

  if (!parsed.success) {
    throw new Error("Enter an account name.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await enforceRateLimit("accountMutation", user.id);

  const { data: existingAccount, error: selectError } = await supabase
    .from("counterparties")
    .select("id")
    .eq("user_id", user.id)
    .ilike("name", parsed.data.name)
    .maybeSingle();

  if (selectError) {
    throw new Error("Unable to check that account.");
  }

  const accountId = existingAccount
    ? existingAccount.id
    : await insertAccount(supabase, user.id, parsed.data.name, parsed.data.websiteUrl);
  const accountIconPath = await uploadAccountIcon(
    supabase,
    user.id,
    accountId,
    getOptionalFile(formData.get("accountIcon"))
  );

  if (existingAccount) {
    const { error: updateError } = await supabase
      .from("counterparties")
      .update({ website_url: parsed.data.websiteUrl })
      .eq("id", accountId)
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error("Unable to update that account.");
    }
  }

  if (!accountIconPath) {
    await applyAccountBrandfetchMatch(supabase, {
      counterpartyId: accountId,
      query: parsed.data.name,
      websiteUrl: parsed.data.websiteUrl,
      userId: user.id
    });
  }

  revalidatePath("/accounts");
  revalidatePath("/entries");
  revalidatePath("/events");
  revalidatePath("/dashboard");
  redirect("/accounts");
}

export async function updateAccountAction(formData: FormData) {
  const parsed = accountSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    websiteUrl: formData.get("websiteUrl") || undefined
  });

  if (!parsed.success || !parsed.data.id) {
    throw new Error("Check the account details and try again.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await enforceRateLimit("accountMutation", user.id);

  const { error } = await supabase
    .from("counterparties")
    .update({ name: parsed.data.name, website_url: parsed.data.websiteUrl })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error("Unable to update that account.");
  }

  const accountIconPath = await uploadAccountIcon(
    supabase,
    user.id,
    parsed.data.id,
    getOptionalFile(formData.get("accountIcon"))
  );

  if (!accountIconPath) {
    await applyAccountBrandfetchMatch(supabase, {
      counterpartyId: parsed.data.id,
      query: parsed.data.name,
      websiteUrl: parsed.data.websiteUrl,
      userId: user.id
    });
  }

  revalidatePath("/accounts");
  revalidatePath(`/accounts/${parsed.data.id}/edit`);
  revalidatePath("/entries");
  revalidatePath("/events");
  revalidatePath("/dashboard");
  redirect("/accounts");
}

async function insertAccount(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  name: string,
  websiteUrl: string | null
) {
  const { data, error } = await supabase
    .from("counterparties")
    .insert({ kind: "other", name, user_id: userId, website_url: websiteUrl })
    .select("id")
    .single();

  if (error) {
    throw new Error("Unable to create that account.");
  }

  return data.id;
}

async function uploadAccountIcon(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  accountId: string,
  file: File | null
) {
  const iconPath = await uploadEntityIcon(supabase, {
    entityId: accountId,
    file,
    kind: "account",
    userId
  });

  if (!iconPath) {
    return null;
  }

  const { error } = await supabase
    .from("counterparties")
    .update({
      icon_storage_path: iconPath,
      icon_updated_at: new Date().toISOString()
    })
    .eq("id", accountId)
    .eq("user_id", userId);

  if (error) {
    throw new Error("Unable to update account icon.");
  }

  return iconPath;
}

function getOptionalFile(value: FormDataEntryValue | null) {
  return value instanceof File ? value : null;
}

function normalizeWebsiteUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
    return parsed.origin;
  } catch {
    return null;
  }
}
