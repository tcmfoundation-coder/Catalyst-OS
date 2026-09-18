import { notFound } from "next/navigation";
import Link from "next/link";
import type { Types } from "mongoose";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { Semester } from "@/models/Semester";
import { AcademicYear } from "@/models/AcademicYear";
import { Course } from "@/models/Course";
import { calculateSemesterGPA } from "@/lib/academic/gpa";
import { CreateCourseForm } from "./create-course-form";
import { GradeForm } from "./grade-form";
import { DeleteCourseButton } from "./delete-course-button";

interface CourseLean {
  _id: Types.ObjectId;
  code: string;
  title: string;
  creditUnits: number;
  grade: string | null;
}

export default async function SemesterDetailPage({
  params,
}: PageProps<"/dashboard/semesters/[id]">) {
  const userId = await requireUserId();
  const { id } = await params;
  await connectToDatabase();

  const semester = await Semester.findOne({ _id: id, userId }).lean();
  if (!semester) {
    notFound();
  }

  const [academicYear, courses] = await Promise.all([
    AcademicYear.findOne({ _id: semester.academicYearId, userId }).lean(),
    Course.find({ semesterId: id }).sort({ createdAt: 1 }).lean<CourseLean[]>(),
  ]);

  const gpa = calculateSemesterGPA(
    courses.map((course) => ({ creditUnits: course.creditUnits, grade: course.grade })),
  );

  return (
    <div className="space-y-6">
      <div>
        {academicYear && (
          <Link
            href={`/dashboard/academic-years/${academicYear._id.toString()}`}
            className="text-sm text-indigo-600 hover:underline"
          >
            ← {academicYear.label}
          </Link>
        )}
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{semester.name}</h1>
        <p className="text-sm text-slate-500">
          Semester GPA: <span className="font-medium text-slate-900">{gpa.gpa.toFixed(2)}</span> ·{" "}
          {gpa.completedCreditUnits} of {gpa.totalCreditUnits} credit units graded
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Add a course</h2>
        <CreateCourseForm semesterId={id} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Courses</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-slate-500">No courses yet.</p>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => (
              <div
                key={course._id.toString()}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {course.code} · {course.title}
                  </p>
                  <p className="text-xs text-slate-500">{course.creditUnits} credit units</p>
                </div>
                <div className="flex items-center gap-3">
                  <GradeForm courseId={course._id.toString()} currentGrade={course.grade} />
                  <DeleteCourseButton courseId={course._id.toString()} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
