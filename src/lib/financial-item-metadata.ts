import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupBrandfetchMatch } from "@/lib/brandfetch";
import type { Database } from "@/lib/database.types";
import { uploadEntityIcon } from "@/lib/entity-icons";

type BillingSupabaseClient = SupabaseClient<Database>;

export type FinancialItemMetadataInput = {
  accountIconFile?: File | null;
  categoryName?: string;
  colorToken: string | null;
  counterpartyId?: string | null;
  counterpartyName?: string;
  planName: string;
  planIconFile?: File | null;
  themeToken?: string | null;
};

export async function applyFinancialItemMetadata(
  supabase: BillingSupabaseClient,
  userId: string,
  financialItemId: string,
  metadata: FinancialItemMetadataInput
) {
  const categoryId = await ensureCategory(supabase, userId, metadata.categoryName);
  const counterpartyId =
    metadata.counterpartyId === null
      ? null
      : metadata.counterpartyId
        ? await ensureCounterpartyById(supabase, userId, metadata.counterpartyId)
        : await ensureCounterparty(
            supabase,
            userId,
            metadata.counterpartyName
          );
  const accountIconPath = counterpartyId
    ? await uploadEntityIcon(supabase, {
        entityId: counterpartyId,
        file: metadata.accountIconFile,
        kind: "account",
        userId
      })
    : null;
  const planIconPath = await uploadEntityIcon(supabase, {
    entityId: financialItemId,
    file: metadata.planIconFile,
    kind: "plan",
    userId
  });

  if (counterpartyId && accountIconPath) {
    const { error: counterpartyIconError } = await supabase
      .from("counterparties")
      .update({
        icon_storage_path: accountIconPath,
        icon_updated_at: new Date().toISOString()
      })
      .eq("id", counterpartyId)
      .eq("user_id", userId);

    if (counterpartyIconError) {
      throw new Error("Unable to update account icon.");
    }
  }

  if (counterpartyId && !accountIconPath && metadata.counterpartyName) {
    await applyAccountBrandfetchMatch(supabase, {
      counterpartyId,
      query: metadata.counterpartyName,
      userId
    });
  }

  const updateValues: Database["public"]["Tables"]["financial_items"]["Update"] = {
    category_id: categoryId,
    color_token: metadata.colorToken,
    counterparty_id: counterpartyId,
    theme_token: metadata.themeToken ?? null
  };

  if (planIconPath) {
    updateValues.icon_storage_path = planIconPath;
    updateValues.icon_updated_at = new Date().toISOString();
  }

  if (!counterpartyId && !planIconPath) {
    const brandfetchMatch = await lookupBrandfetchMatch(metadata.planName);

    if (brandfetchMatch) {
      updateValues.brandfetch_brand_id = brandfetchMatch.brandId;
      updateValues.brandfetch_domain = brandfetchMatch.domain;
      updateValues.brandfetch_icon_url = brandfetchMatch.iconUrl;
      updateValues.brandfetch_name = brandfetchMatch.name;
      updateValues.brandfetch_updated_at = new Date().toISOString();
    }
  }

  const { error } = await supabase
    .from("financial_items")
    .update(updateValues)
    .eq("id", financialItemId)
    .eq("user_id", userId);

  if (error) {
    throw new Error("Unable to update plan metadata.");
  }

  return { categoryId, counterpartyId };
}

export async function applyAccountBrandfetchMatch(
  supabase: BillingSupabaseClient,
  {
    counterpartyId,
    query,
    userId
  }: {
    counterpartyId: string;
    query: string;
    userId: string;
  }
) {
  const brandfetchMatch = await lookupBrandfetchMatch(query);

  if (!brandfetchMatch) {
    return;
  }

  const { error } = await supabase
    .from("counterparties")
    .update({
      brandfetch_brand_id: brandfetchMatch.brandId,
      brandfetch_domain: brandfetchMatch.domain,
      brandfetch_icon_url: brandfetchMatch.iconUrl,
      brandfetch_name: brandfetchMatch.name,
      brandfetch_updated_at: new Date().toISOString()
    })
    .eq("id", counterpartyId)
    .eq("user_id", userId);

  if (error) {
    throw new Error("Unable to update account logo match.");
  }
}

export async function ensureCategory(
  supabase: BillingSupabaseClient,
  userId: string,
  name: string | undefined
) {
  if (!name) {
    return null;
  }

  const { data: existingCategory, error: selectError } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle();

  if (selectError) {
    throw new Error("Unable to load categories.");
  }

  if (existingCategory) {
    return existingCategory.id;
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({ name, kind: "both", user_id: userId })
    .select("id")
    .single();

  if (error) {
    throw new Error("Unable to save category.");
  }

  return data.id;
}

export async function ensureCounterparty(
  supabase: BillingSupabaseClient,
  userId: string,
  name: string | undefined
) {
  if (!name) {
    return null;
  }

  const { data: existingCounterparty, error: selectError } = await supabase
    .from("counterparties")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle();

  if (selectError) {
    throw new Error("Unable to load counterparties.");
  }

  if (existingCounterparty) {
    return existingCounterparty.id;
  }

  const { data, error } = await supabase
    .from("counterparties")
    .insert({ name, kind: "other", user_id: userId })
    .select("id")
    .single();

  if (error) {
    throw new Error("Unable to save counterparty.");
  }

  return data.id;
}

export async function ensureCounterpartyById(
  supabase: BillingSupabaseClient,
  userId: string,
  id: string
) {
  const { data, error } = await supabase
    .from("counterparties")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load account.");
  }

  if (!data) {
    throw new Error("Choose a valid account.");
  }

  return data.id;
}
