import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Database } from "@/lib/database.types";

const ICON_BUCKET = "account-icons";
const ICON_MAX_BYTES = 1024 * 1024;
const ICON_MIME_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"]
]);

type BillingSupabaseClient = SupabaseClient<Database>;

const getCachedSignedIconUrl = (supabase: BillingSupabaseClient) =>
  unstable_cache(
    async (path: string) => {
      const { data } = await supabase.storage
        .from(ICON_BUCKET)
        .createSignedUrl(path, 60 * 60);

      return data?.signedUrl ?? null;
    },
    ["account-icons", "signed-url"],
    { revalidate: 3500 }
  );

export type EntityIconSource = {
  accountBrandfetchIconUrl?: string | null;
  accountIconPath?: string | null;
  planBrandfetchIconUrl?: string | null;
  planIconPath?: string | null;
  title: string;
};

export type ResolvedEntityIcon = {
  alt: string;
  brandfetchUrl: string | null;
  initials: string;
  signedUrl: string | null;
};

export function getInitials(title: string) {
  const words = title
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  const letters = words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return letters || "?";
}

export async function uploadEntityIcon(
  supabase: BillingSupabaseClient,
  {
    entityId,
    file,
    kind,
    userId
  }: {
    entityId: string;
    file: File | null | undefined;
    kind: "account" | "plan";
    userId: string;
  }
) {
  if (!file || file.size === 0) {
    return null;
  }

  const extension = ICON_MIME_TYPES.get(file.type);

  if (!extension) {
    throw new Error("Upload a PNG, JPG, or WebP icon.");
  }

  if (file.size > ICON_MAX_BYTES) {
    throw new Error("Upload an icon smaller than 1 MB.");
  }

  const storagePath = `${userId}/${kind}s/${entityId}-${Date.now()}.${extension}`;
  const { error } = await supabase.storage
    .from(ICON_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true
    });

  if (error) {
    throw new Error("Unable to upload that icon.");
  }

  return storagePath;
}

export async function resolveEntityIcons(
  supabase: BillingSupabaseClient,
  iconSources: EntityIconSource[]
) {
  const pathSet = new Set<string>();

  for (const source of iconSources) {
    const iconPath = source.planIconPath ?? source.accountIconPath;

    if (iconPath) {
      pathSet.add(iconPath);
    }
  }

  const signedUrls = new Map<string, string>();
  const createSignedIconUrl = getCachedSignedIconUrl(supabase);

  await Promise.all(
    Array.from(pathSet).map(async (path) => {
      const signedUrl = await createSignedIconUrl(path);

      if (signedUrl) {
        signedUrls.set(path, signedUrl);
      }
    })
  );

  return iconSources.map((source): ResolvedEntityIcon => {
    const iconPath = source.planIconPath ?? source.accountIconPath ?? null;
    const brandfetchUrl =
      source.planBrandfetchIconUrl ?? source.accountBrandfetchIconUrl ?? null;

    return {
      alt: `${source.title} icon`,
      brandfetchUrl,
      initials: getInitials(source.title),
      signedUrl: iconPath ? signedUrls.get(iconPath) ?? null : null
    };
  });
}
