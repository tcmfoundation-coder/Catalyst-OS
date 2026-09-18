import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { AcademicYear } from "@/models/AcademicYear";
import { Semester } from "@/models/Semester";
import { CreateSemesterForm } from "./create-form";
import { SetCurrentSemesterButton } from "./set-current-button";

export default async function AcademicYearDetailPage({
  params,
}: PageProps<"/dashboard/academic-years/[id]">) {
  const userId = await requireUserId();
  const { id } = await params;
  await connectToDatabase();

  const year = await AcademicYear.findOne({ _id: id, userId }).lean();
  if (!year) {
    notFound();
  }

  const semesters = await Semester.find({ academicYearId: id }).sort({ order: 1 }).lean();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/academic-years"
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Academic years
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{year.label}</h1>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Add a semester</h2>
        <CreateSemesterForm academicYearId={id} />
      </section>

      <section className="space-y-3">
        {semesters.length === 0 ? (
          <p className="text-sm text-slate-500">No semesters yet for this academic year.</p>
        ) : (
          semesters.map((semester) => (
            <div
              key={semester._id.toString()}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div>
                <Link
                  href={`/dashboard/semesters/${semester._id.toString()}`}
                  className="font-medium text-slate-900 hover:text-indigo-600"
                >
                  {semester.name}
                </Link>
                {semester.isCurrent && (
                  <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                    Current
                  </span>
                )}
              </div>
              {!semester.isCurrent && (
                <SetCurrentSemesterButton semesterId={semester._id.toString()} />
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
