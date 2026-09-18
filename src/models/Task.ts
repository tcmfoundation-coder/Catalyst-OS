import { Schema, model, models, type Document, type Model, type Types } from "mongoose";
import { TASK_TYPES, TASK_PRIORITIES, TASK_STATUSES, type TaskType, type TaskPriority, type TaskStatus } from "@/lib/tasks/constants";

export interface ITask extends Document {
  userId: Types.ObjectId;
  courseId: Types.ObjectId | null;
  title: string;
  description: string | null;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Optional: a task doesn't have to belong to a course. When set, it must
    // be validated at the application layer (see lib/actions/tasks.ts) to
    // belong to the same user before being written.
    courseId: { type: Schema.Types.ObjectId, ref: "Course", default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    type: { type: String, enum: TASK_TYPES, required: true, default: "assignment" },
    priority: { type: String, enum: TASK_PRIORITIES, required: true, default: "medium" },
    status: { type: String, enum: TASK_STATUSES, required: true, default: "todo" },
    dueDate: { type: Date, default: null },
    // Set/cleared by the status-transition logic in lib/tasks/lifecycle.ts,
    // not user-editable directly. "Overdue" is derived from dueDate + status
    // (see lib/tasks/overdue.ts) rather than stored, so it can't drift out
    // of sync with them.
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

TaskSchema.index({ userId: 1, status: 1 });
TaskSchema.index({ userId: 1, dueDate: 1 });

export const Task: Model<ITask> = models.Task ?? model<ITask>("Task", TaskSchema);
