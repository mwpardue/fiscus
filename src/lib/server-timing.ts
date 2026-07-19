export function createServerTimer(scope: string) {
  const startedAt = Date.now();
  let previousAt = startedAt;

  function log(label: string, details?: Record<string, string | number | boolean>) {
    const now = Date.now();
    const elapsedMs = now - startedAt;
    const deltaMs = now - previousAt;
    previousAt = now;
    const detailText = details
      ? ` ${Object.entries(details)
          .map(([key, value]) => `${key}=${value}`)
          .join(" ")}`
      : "";

    console.info(
      `[perf] ${scope} ${label} elapsed=${elapsedMs}ms delta=${deltaMs}ms${detailText}`
    );
  }

  return {
    done(details?: Record<string, string | number | boolean>) {
      log("done", details);
    },
    mark: log
  };
}
