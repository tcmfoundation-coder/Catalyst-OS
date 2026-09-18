"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 3000;

/**
 * Refreshes the current route periodically so a still-processing
 * material's status updates without a manual reload. The parent page only
 * renders this when the server-fetched data already shows something in
 * "uploaded"/"processing" — once nothing is, the parent stops rendering
 * it and the interval is cleared. This is real persisted state being
 * re-fetched, not a simulated progress indicator.
 */
export function ProcessingPoller() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
