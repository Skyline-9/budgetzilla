export function initPerformanceMonitoring() {
  if (import.meta.env.PROD) return;

  try {
    // 1. Monitor Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      if (entries.length > 0) {
        const lastEntry = entries[entries.length - 1] as any;
        console.log(`[Performance] LCP: ${lastEntry.startTime.toFixed(2)}ms`, lastEntry.element);
      }
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

    // 2. Monitor Interaction to Next Paint (INP) / First Input Delay (FID)
    const inpObserver = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry: any) => {
        const delay = entry.duration;
        if (delay > 100) {
          console.warn(`[Performance] Long Interaction (${entry.entryType}): ${delay.toFixed(2)}ms on element:`, entry.target);
        } else {
          console.log(`[Performance] Interaction (${entry.entryType}): ${delay.toFixed(2)}ms`);
        }
      });
    });
    inpObserver.observe({ type: "first-input", buffered: true });
    inpObserver.observe({ type: "event", buffered: true, durationThreshold: 50 } as any);
  } catch (e) {
    console.warn("[Performance] PerformanceObserver not supported", e);
  }
}
