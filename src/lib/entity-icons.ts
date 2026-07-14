import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const ICON_BUCKET = "account-icons";
const ICON_MAX_BYTES = 1024 * 1024;
const SIGNED_ICON_URL_TTL_MS = 3500 * 1000;
const ICON_MIME_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"]
]);

type BillingSupabaseClient = SupabaseClient<Database>;

const signedIconUrlCache = new Map<
  string,
  {
    expiresAt: number;
    signedUrl: string;
  }
>();

async function getCachedSignedIconUrl(
  supabase: BillingSupabaseClient,
  path: string
) {
  const cached = signedIconUrlCache.get(path);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.signedUrl;
  }

  const { data } = await supabase.storage
    .from(ICON_BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (!data?.signedUrl) {
    signedIconUrlCache.delete(path);
    return null;
  }

  signedIconUrlCache.set(path, {
    expiresAt: now + SIGNED_ICON_URL_TTL_MS,
    signedUrl: data.signedUrl
  });

  return data.signedUrl;
}

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

  await Promise.all(
    Array.from(pathSet).map(async (path) => {
      const signedUrl = await getCachedSignedIconUrl(supabase, path);

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
