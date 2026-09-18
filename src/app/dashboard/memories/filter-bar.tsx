import { MEMORY_CATEGORIES, MEMORY_CATEGORY_LABELS } from "@/lib/learning-memories/constants";

interface CourseOption {
  id: string;
  label: string;
}

const fieldClassName =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

// A plain GET form — no client JS needed. Submitting re-navigates to
// /dashboard/memories with the chosen filters as query params, which the
// list page (a Server Component) reads directly from searchParams.
export function MemoryFilterBar({
  courses,
  category,
  courseId,
  q,
}: {
  courses: CourseOption[];
  category: string;
  courseId: string;
  q: string;
}) {
  return (
    <form action="/dashboard/memories" method="get" className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Search memories..."
        className={`min-w-[200px] flex-1 ${fieldClassName}`}
      />
      <select name="category" defaultValue={category} className={fieldClassName}>
        <option value="">All categories</option>
        {MEMORY_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {MEMORY_CATEGORY_LABELS[cat]}
          </option>
        ))}
      </select>
      {courses.length > 0 && (
        <select name="course" defaultValue={courseId} className={fieldClassName}>
          <option value="">All courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.label}
            </option>
          ))}
        </select>
      )}
      <button
        type="submit"
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        Filter
      </button>
    </form>
  );
}
