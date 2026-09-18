"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteStudyNotesAction } from "@/lib/actions/study-resources";

export function DeleteNotesButton({ resourceId }: { resourceId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete these study notes? This cannot be undone.")) return;
    setDeleting(true);
    const result = await deleteStudyNotesAction(resourceId);
    if (result.ok) {
      router.push("/dashboard/study-notes");
    } else {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-60"
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
