const DEFAULT_AUTH_REDIRECT = "/dashboard";

export function normalizeAuthRedirect(value: string | null) {
  if (!value) {
    return DEFAULT_AUTH_REDIRECT;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT;
  }

  try {
    const parsed = new URL(value, "http://local.test");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_AUTH_REDIRECT;
  }
}
