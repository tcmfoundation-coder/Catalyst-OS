"use client";

import { deleteStudySession } from "@/lib/actions/study-sessions";

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  return (
    <form action={deleteStudySession.bind(null, sessionId)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Delete
      </button>
    </form>
  );
}
