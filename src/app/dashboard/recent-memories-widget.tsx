import Link from "next/link";
import { MEMORY_CATEGORY_LABELS, type MemoryCategory } from "@/lib/learning-memories/constants";

export interface RecentMemoryData {
  id: string;
  content: string;
  category: MemoryCategory;
}

const CATEGORY_STYLES: Record<MemoryCategory, string> = {
  insight: "bg-accent/10 text-accent",
  difficulty: "bg-danger/10 text-danger",
  preference: "bg-sky-400/10 text-sky-300",
  reminder: "bg-caution/10 text-caution",
  general: "bg-surface-raised text-muted",
};

export function RecentMemoriesWidget({ memories }: { memories: RecentMemoryData[] }) {
  return (
    <section className="hud-panel rounded-2xl p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Memory archive</h2>
        <Link
          href="/dashboard/memories"
          className="text-xs font-medium text-accent hover:underline"
        >
          View all
        </Link>
      </div>
      {memories.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing jotted down yet.{" "}
          <Link
            href="/dashboard/memories/new"
            className="font-medium text-accent hover:underline"
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
              className="border-b border-line/70 pb-3 last:border-0 last:pb-0"
            >
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[memory.category]}`}
              >
                {MEMORY_CATEGORY_LABELS[memory.category]}
              </span>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{memory.content}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
