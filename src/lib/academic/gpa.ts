import { DEFAULT_GRADING_SCALE, type GradingScale } from "./grading-scale";

export interface GradedCourse {
  creditUnits: number;
  grade: string | null;
}

export interface GpaResult {
  gpa: number;
  totalCreditUnits: number;
  completedCreditUnits: number;
  remainingCreditUnits: number;
}

function gradePoint(letter: string, scale: GradingScale): number {
  const point = scale[letter.toUpperCase()];
  if (point === undefined) {
    throw new Error(`Unknown grade "${letter}": not present in the configured grading scale`);
  }
  return point;
}

function calculateWeightedGpa(courses: GradedCourse[], scale: GradingScale): GpaResult {
  let totalCreditUnits = 0;
  let completedCreditUnits = 0;
  let qualityPoints = 0;

  for (const course of courses) {
    totalCreditUnits += course.creditUnits;
    if (!course.grade) continue;
    completedCreditUnits += course.creditUnits;
    qualityPoints += gradePoint(course.grade, scale) * course.creditUnits;
  }

  const gpa = completedCreditUnits === 0 ? 0 : qualityPoints / completedCreditUnits;

  return {
    gpa: Math.round(gpa * 100) / 100,
    totalCreditUnits,
    completedCreditUnits,
    remainingCreditUnits: totalCreditUnits - completedCreditUnits,
  };
}

/** GPA for a single semester's courses. */
export function calculateSemesterGPA(
  courses: GradedCourse[],
  scale: GradingScale = DEFAULT_GRADING_SCALE,
): GpaResult {
  return calculateWeightedGpa(courses, scale);
}

/** Cumulative GPA (CGPA) across every course the student has taken. */
export function calculateCGPA(
  allCourses: GradedCourse[],
  scale: GradingScale = DEFAULT_GRADING_SCALE,
): GpaResult {
  return calculateWeightedGpa(allCourses, scale);
}
