import Link from "next/link";
import type { Types, QueryFilter } from "mongoose";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { LearningMemory, type ILearningMemory } from "@/models/LearningMemory";
import { Course } from "@/models/Course";
import {
  MEMORY_CATEGORIES,
  MEMORY_CATEGORY_LABELS,
  type MemoryCategory,
} from "@/lib/learning-memories/constants";
import { escapeRegExp } from "@/lib/learning-memories/search";
import { MemoryFilterBar } from "../filter-bar";
import { DeleteMemoryButton } from "../delete-memory-button";

interface MemoryLean {
  _id: Types.ObjectId;
  content: string;
  category: MemoryCategory;
  createdAt: Date;
  courseId: { _id: Types.ObjectId; code: string; title: string } | null;
}

const CATEGORY_STYLES: Record<MemoryCategory, string> = {
  insight: "bg-emerald-50 text-emerald-700",
  difficulty: "bg-red-50 text-red-700",
  preference: "bg-sky-50 text-sky-700",
  reminder: "bg-amber-50 text-amber-700",
  general: "bg-slate-100 text-slate-600",
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function MemoriesPage({
  searchParams,
}: PageProps<"/dashboard/memories">) {
  const userId = await requireUserId();
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q.trim() : "";
  const categoryFilter =
    typeof params.category === "string" &&
    (MEMORY_CATEGORIES as readonly string[]).includes(params.category)
      ? (params.category as MemoryCategory)
      : "";
  const courseFilter = typeof params.course === "string" ? params.course : "";

  await connectToDatabase();

  const query: QueryFilter<ILearningMemory> = { userId };
  if (categoryFilter) query.category = categoryFilter;
  if (courseFilter) query.courseId = courseFilter;
  if (q) query.content = { $regex: escapeRegExp(q), $options: "i" };

  const [memories, courses, totalMemoryCount] = await Promise.all([
    LearningMemory.find(query)
      .populate("courseId", "code title")
      .sort({ createdAt: -1 })
      .lean<MemoryLean[]>(),
    Course.find({ userId }).select("code title").sort({ code: 1 }).lean(),
    LearningMemory.countDocuments({ userId }),
  ]);

  const courseOptions = courses.map((course) => ({
    id: course._id.toString(),
    label: `${course.code} · ${course.title}`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Memories</h1>
        <Link
          href="/dashboard/memories/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          New memory
        </Link>
      </div>

      {totalMemoryCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">No memories yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Jot down insights, confusions, or preferences as you study — small notes your future
            self will thank you for.
          </p>
          <Link
            href="/dashboard/memories/new"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Write your first memory
          </Link>
        </div>
      ) : (
        <>
          <MemoryFilterBar
            courses={courseOptions}
            category={categoryFilter}
            courseId={courseFilter}
            q={q}
          />

          {memories.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No memories match these filters.
            </p>
          ) : (
            <div className="space-y-3">
              {memories.map((memory) => (
                <div
                  key={memory._id.toString()}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[memory.category]}`}
                      >
                        {MEMORY_CATEGORY_LABELS[memory.category]}
                      </span>
                      {memory.courseId && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {memory.courseId.code}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{formatDate(memory.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <Link
                        href={`/dashboard/memories/${memory._id.toString()}/edit`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        Edit
                      </Link>
                      <DeleteMemoryButton memoryId={memory._id.toString()} />
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                    {memory.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
