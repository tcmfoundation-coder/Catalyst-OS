"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { retryMaterialProcessing } from "@/lib/actions/study-materials";

export function RetryProcessingButton({ materialId }: { materialId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await retryMaterialProcessing(materialId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not restart processing. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <button type="button" onClick={() => void retry()} disabled={busy} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 disabled:opacity-60">
        {busy ? "Restarting…" : "Retry processing"}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
