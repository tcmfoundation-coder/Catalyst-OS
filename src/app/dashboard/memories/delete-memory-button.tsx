"use client";

import { deleteLearningMemory } from "@/lib/actions/learning-memories";

export function DeleteMemoryButton({ memoryId }: { memoryId: string }) {
  return (
    <form action={deleteLearningMemory.bind(null, memoryId)}>
      <button type="submit" className="font-medium text-red-500 hover:text-red-700">
        Delete
      </button>
    </form>
  );
}
