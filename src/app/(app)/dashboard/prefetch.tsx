"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function DashboardPrefetch({ visibleEnds }: { visibleEnds: string[] }) {
  const router = useRouter();
  const visibleEndKey = visibleEnds.join("|");

  useEffect(() => {
    const controller = new AbortController();
    const uniqueVisibleEnds = Array.from(new Set(visibleEndKey.split("|")));

    Promise.all(
      uniqueVisibleEnds.map((visibleEnd) =>
        fetch("/dashboard/prefetch", {
          body: JSON.stringify({ visibleEnd }),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal: controller.signal
        })
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null)
      )
    ).then((results) => {
      if (
        !controller.signal.aborted &&
        results.some(
          (result) =>
            result &&
            typeof result.generatedCount === "number" &&
            result.generatedCount > 0
        )
      ) {
        router.refresh();
      }
    });

    return () => controller.abort();
  }, [router, visibleEndKey]);

  return null;
}
