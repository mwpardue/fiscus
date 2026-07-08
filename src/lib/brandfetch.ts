import { getServerEnv } from "@/lib/env";

const BRANDFETCH_SEARCH_URL = "https://api.brandfetch.io/v2/search";
const BRANDFETCH_CDN_URL = "https://cdn.brandfetch.io";

type BrandfetchSearchResult = {
  brandId?: string | null;
  claimed?: boolean | null;
  domain?: string | null;
  icon?: string | null;
  name?: string | null;
};

export type BrandfetchMatch = {
  brandId: string | null;
  domain: string;
  iconUrl: string;
  name: string | null;
};

export async function lookupBrandfetchMatch(query: string) {
  const trimmedQuery = query.trim();
  const { BRANDFETCH_CLIENT_ID } = getServerEnv();

  if (!BRANDFETCH_CLIENT_ID || trimmedQuery.length < 2) {
    return null;
  }

  const response = await fetch(
    `${BRANDFETCH_SEARCH_URL}/${encodeURIComponent(trimmedQuery)}?c=${encodeURIComponent(BRANDFETCH_CLIENT_ID)}`,
    {
      headers: {
        accept: "application/json"
      },
      next: { revalidate: 60 * 60 * 24 }
    }
  ).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const results = (await response.json().catch(() => [])) as BrandfetchSearchResult[];
  const match = results.find((result) => normalizeDomain(result.domain));
  const domain = normalizeDomain(match?.domain);

  if (!match || !domain) {
    return null;
  }

  const iconUrl = buildBrandfetchLogoUrl(domain);

  if (!iconUrl) {
    return null;
  }

  return {
    brandId: match.brandId ?? null,
    domain,
    iconUrl,
    name: match.name ?? null
  } satisfies BrandfetchMatch;
}

export function buildBrandfetchLogoUrl(domain: string) {
  const { BRANDFETCH_CLIENT_ID } = getServerEnv();
  const normalizedDomain = normalizeDomain(domain);

  if (!BRANDFETCH_CLIENT_ID || !normalizedDomain) {
    return null;
  }

  return `${BRANDFETCH_CDN_URL}/domain/${encodeURIComponent(normalizedDomain)}/w/128/h/128/fallback/404/type/icon?c=${encodeURIComponent(BRANDFETCH_CLIENT_ID)}`;
}

function normalizeDomain(domain: string | null | undefined) {
  if (!domain) {
    return null;
  }

  const trimmedDomain = domain.trim();

  if (!trimmedDomain) {
    return null;
  }

  try {
    const parsed = new URL(
      trimmedDomain.startsWith("http") ? trimmedDomain : `https://${trimmedDomain}`
    );
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
