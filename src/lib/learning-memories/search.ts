/**
 * Escapes regex special characters so user-supplied search text can be used
 * safely in a MongoDB $regex query, without risking a malformed/injected
 * pattern or pathological backtracking from characters like `.` `*` `+`.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
