"use client";

import { completeTask, reopenTask } from "@/lib/actions/tasks";

export function StatusToggle({ taskId, completed }: { taskId: string; completed: boolean }) {
  const action = completed ? reopenTask.bind(null, taskId) : completeTask.bind(null, taskId);

  return (
    <form action={action}>
      <button
        type="submit"
        aria-label={completed ? "Reopen task" : "Mark task complete"}
        title={completed ? "Reopen task" : "Mark task complete"}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs transition ${
          completed
            ? "border-accent bg-accent text-background hover:brightness-110"
            : "border-line bg-surface text-transparent hover:border-accent"
        }`}
      >
        ✓
      </button>
    </form>
  );
}
