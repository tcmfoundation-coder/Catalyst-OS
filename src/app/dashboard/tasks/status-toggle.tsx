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
            ? "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700"
            : "border-slate-300 bg-white text-transparent hover:border-indigo-400"
        }`}
      >
        ✓
      </button>
    </form>
  );
}
