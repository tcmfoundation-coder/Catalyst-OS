"use client";

import { deleteTask } from "@/lib/actions/tasks";

export function DeleteTaskButton({ taskId }: { taskId: string }) {
  return (
    <form action={deleteTask.bind(null, taskId)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Delete
      </button>
    </form>
  );
}
