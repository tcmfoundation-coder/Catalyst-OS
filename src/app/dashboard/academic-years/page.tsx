import Link from "next/link";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { AcademicYear } from "@/models/AcademicYear";
import { CreateAcademicYearForm } from "./create-form";
import { SetCurrentYearButton } from "./set-current-button";

export default async function AcademicYearsPage() {
  const userId = await requireUserId();
  await connectToDatabase();

  const years = await AcademicYear.find({ userId }).sort({ createdAt: -1 }).lean();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Academic years</h1>
        <p className="text-sm text-slate-500">
          Organize your studies by academic year and semester.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Add a new academic year</h2>
        <CreateAcademicYearForm />
      </section>

      <section className="space-y-3">
        {years.length === 0 ? (
          <p className="text-sm text-slate-500">No academic years yet.</p>
        ) : (
          years.map((year) => (
            <div
              key={year._id.toString()}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div>
                <Link
                  href={`/dashboard/academic-years/${year._id.toString()}`}
                  className="font-medium text-slate-900 hover:text-indigo-600"
                >
                  {year.label}
                </Link>
                {year.isCurrent && (
                  <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                    Current
                  </span>
                )}
              </div>
              {!year.isCurrent && <SetCurrentYearButton yearId={year._id.toString()} />}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
