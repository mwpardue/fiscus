import type { ResolvedEntityIcon } from "@/lib/entity-icons";

export function EntityIcon({
  icon,
  size = "md"
}: {
  icon: ResolvedEntityIcon;
  size?: "sm" | "md" | "lg";
}) {
  const className =
    size === "sm"
      ? "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-paper text-sm font-semibold text-ink"
      : size === "lg"
        ? "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-paper text-base font-semibold text-ink"
        : "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-paper text-base font-semibold text-ink";

  if (icon.signedUrl) {
    return (
      <span className={className}>
        <img
          alt={icon.alt}
          className="h-full w-full object-contain p-1"
          src={icon.signedUrl}
        />
      </span>
    );
  }

  if (icon.brandfetchUrl) {
    return (
      <span className={className}>
        <img
          alt={icon.alt}
          className="h-full w-full object-contain p-1"
          referrerPolicy="strict-origin-when-cross-origin"
          src={icon.brandfetchUrl}
        />
      </span>
    );
  }

  return (
    <span aria-label={icon.alt} className={className}>
      {icon.initials}
    </span>
  );
}
