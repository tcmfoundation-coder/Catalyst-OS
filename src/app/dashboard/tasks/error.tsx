"use client";

import { useEffect } from "react";

export default function TasksError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-dashed border-red-200 bg-red-50 p-8 text-center">
      <h2 className="text-base font-semibold text-red-700">Couldn&apos;t load your tasks</h2>
      <p className="mt-1 text-sm text-red-600">Something went wrong. You can try again.</p>
      <button
        onClick={retry}
        className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
      >
        Try again
      </button>
    </div>
  );
}
