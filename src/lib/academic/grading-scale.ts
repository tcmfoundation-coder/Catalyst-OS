export type GradingScale = Record<string, number>;

/**
 * Default 5-point grading scale. Institutions vary (4.0, 4.3, 5.0, ...) —
 * override this map to match yours. The GPA engine itself (see gpa.ts)
 * makes no assumptions about the scale or the set of valid letters.
 */
export const DEFAULT_GRADING_SCALE: GradingScale = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
  F: 0,
};

export function isValidGrade(letter: string, scale: GradingScale = DEFAULT_GRADING_SCALE): boolean {
  return Object.prototype.hasOwnProperty.call(scale, letter.toUpperCase());
}
