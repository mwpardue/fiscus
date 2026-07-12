import Link from "next/link";
import type { Route } from "next";

export function BackLink({
  fallbackHref,
  href,
  label = "Back"
}: {
  fallbackHref: Route;
  href?: string | null;
  label?: string;
}) {
  const safeHref = getSafeHref(href, fallbackHref);

  return (
    <Link
      className="inline-flex min-h-10 items-center justify-center rounded border border-line bg-white px-3 text-sm font-semibold text-ink"
      href={safeHref}
    >
      {label}
    </Link>
  );
}

function getSafeHref(href: string | null | undefined, fallbackHref: Route) {
  if (!href || !href.startsWith("/") || href.startsWith("//")) {
    return fallbackHref;
  }

  return href as Route;
}
