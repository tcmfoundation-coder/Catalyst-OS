import { describe, expect, it } from "vitest";
import { calculateCGPA, calculateSemesterGPA, type GradedCourse } from "./gpa";
import { DEFAULT_GRADING_SCALE, isValidGrade } from "./grading-scale";

describe("calculateSemesterGPA", () => {
  it("returns zero for an empty course list", () => {
    expect(calculateSemesterGPA([])).toEqual({
      gpa: 0,
      totalCreditUnits: 0,
      completedCreditUnits: 0,
      remainingCreditUnits: 0,
    });
  });

  it("computes a credit-weighted average across graded courses", () => {
    const courses: GradedCourse[] = [
      { creditUnits: 5, grade: "A" }, // 5 * 5 = 25
      { creditUnits: 3, grade: "B" }, // 3 * 4 = 12
      { creditUnits: 2, grade: "C" }, // 2 * 3 = 6
    ];
    // (25 + 12 + 6) / (5 + 3 + 2) = 43 / 10 = 4.3
    const result = calculateSemesterGPA(courses);
    expect(result.gpa).toBe(4.3);
    expect(result.totalCreditUnits).toBe(10);
    expect(result.completedCreditUnits).toBe(10);
    expect(result.remainingCreditUnits).toBe(0);
  });

  it("excludes ungraded courses from GPA but counts them as remaining", () => {
    const courses: GradedCourse[] = [
      { creditUnits: 5, grade: "A" },
      { creditUnits: 3, grade: "B" },
      { creditUnits: 2, grade: "C" },
      { creditUnits: 3, grade: null }, // in progress, not yet graded
    ];
    const result = calculateSemesterGPA(courses);
    expect(result.gpa).toBe(4.3);
    expect(result.totalCreditUnits).toBe(13);
    expect(result.completedCreditUnits).toBe(10);
    expect(result.remainingCreditUnits).toBe(3);
  });

  it("is case-insensitive for grade letters", () => {
    const result = calculateSemesterGPA([{ creditUnits: 4, grade: "a" }]);
    expect(result.gpa).toBe(5);
  });

  it("throws when a grade is not part of the configured scale", () => {
    expect(() => calculateSemesterGPA([{ creditUnits: 3, grade: "Z" }])).toThrow(
      /Unknown grade/,
    );
  });

  it("supports a custom grading scale", () => {
    const fourPointScale = { A: 4, B: 3, C: 2, D: 1, F: 0 };
    const result = calculateSemesterGPA([{ creditUnits: 4, grade: "A" }], fourPointScale);
    expect(result.gpa).toBe(4);
  });
});

describe("calculateCGPA", () => {
  it("aggregates courses across multiple semesters into one cumulative figure", () => {
    const semesterOne: GradedCourse[] = [
      { creditUnits: 5, grade: "A" }, // 25
      { creditUnits: 3, grade: "B" }, // 12
    ];
    const semesterTwo: GradedCourse[] = [
      { creditUnits: 4, grade: "C" }, // 12
      { creditUnits: 2, grade: "F" }, // 0
    ];
    // qp = 25 + 12 + 12 + 0 = 49, units = 5 + 3 + 4 + 2 = 14
    // cgpa = 49 / 14 = 3.5
    const result = calculateCGPA([...semesterOne, ...semesterTwo]);
    expect(result.gpa).toBe(3.5);
    expect(result.completedCreditUnits).toBe(14);
  });
});

describe("isValidGrade", () => {
  it("accepts letters present in the default scale", () => {
    expect(isValidGrade("A")).toBe(true);
    expect(isValidGrade("f")).toBe(true);
  });

  it("rejects letters outside the scale", () => {
    expect(isValidGrade("Z", DEFAULT_GRADING_SCALE)).toBe(false);
  });
});
