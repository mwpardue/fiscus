"use client";

import { useEffect } from "react";

export function DashboardPrefetch({ visibleEnd }: { visibleEnd: string }) {
  useEffect(() => {
    const controller = new AbortController();

    fetch("/dashboard/prefetch", {
      body: JSON.stringify({ visibleEnd }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: controller.signal
    }).catch(() => {
      // The current dashboard view is already loaded; this is only a warm-up.
    });

    return () => controller.abort();
  }, [visibleEnd]);

  return null;
}
