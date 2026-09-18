import Link from "next/link";
import { MEMORY_CATEGORY_LABELS, type MemoryCategory } from "@/lib/learning-memories/constants";

export interface RecentMemoryData {
  id: string;
  content: string;
  category: MemoryCategory;
}

const CATEGORY_STYLES: Record<MemoryCategory, string> = {
  insight: "bg-emerald-50 text-emerald-700",
  difficulty: "bg-red-50 text-red-700",
  preference: "bg-sky-50 text-sky-700",
  reminder: "bg-amber-50 text-amber-700",
  general: "bg-slate-100 text-slate-600",
};

export function RecentMemoriesWidget({ memories }: { memories: RecentMemoryData[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Recent memories</h2>
        <Link
          href="/dashboard/memories"
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          View all
        </Link>
      </div>
      {memories.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nothing jotted down yet.{" "}
          <Link
            href="/dashboard/memories/new"
            className="font-medium text-indigo-600 hover:underline"
          >
            Write your first memory
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-3">
          {memories.map((memory) => (
            <div
              key={memory.id}
              className="border-b border-slate-100 pb-3 last:border-0 last:pb-0"
            >
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[memory.category]}`}
              >
                {MEMORY_CATEGORY_LABELS[memory.category]}
              </span>
              <p className="mt-1 line-clamp-2 text-sm text-slate-700">{memory.content}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
