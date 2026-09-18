import { describe, expect, it } from "vitest";
import { buildOwnershipFilter } from "./service";
import type { VectorOwner } from "./vector-index";

function owner(overrides: Partial<VectorOwner> = {}): VectorOwner {
  return { materialId: "material-1", userId: "user-a", courseId: null, ...overrides };
}

describe("buildOwnershipFilter", () => {
  it("accepts a vector owned by the requesting user with no extra filter", () => {
    const filter = buildOwnershipFilter("user-a", undefined, null);
    expect(filter(owner({ userId: "user-a" }))).toBe(true);
  });

  it("rejects a vector owned by a different user, unconditionally", () => {
    const filter = buildOwnershipFilter("user-a", undefined, null);
    expect(filter(owner({ userId: "user-b" }))).toBe(false);
  });

  it("a materialId filter never widens access to another user's chunk with a matching materialId", () => {
    const filter = buildOwnershipFilter("user-a", { materialId: "material-1" }, null);
    // Same materialId, but owned by a different user -> must still be rejected.
    expect(filter(owner({ userId: "user-b", materialId: "material-1" }))).toBe(false);
  });

  it("a courseId filter never widens access to another user's chunk with a matching courseId", () => {
    const filter = buildOwnershipFilter("user-a", { courseId: "course-1" }, null);
    expect(filter(owner({ userId: "user-b", courseId: "course-1" }))).toBe(false);
  });

  it("materialId filter narrows results to only that material for the owning user", () => {
    const filter = buildOwnershipFilter("user-a", { materialId: "material-1" }, null);
    expect(filter(owner({ userId: "user-a", materialId: "material-1" }))).toBe(true);
    expect(filter(owner({ userId: "user-a", materialId: "material-2" }))).toBe(false);
  });

  it("courseId filter narrows results to only that course for the owning user", () => {
    const filter = buildOwnershipFilter("user-a", { courseId: "course-1" }, null);
    expect(filter(owner({ userId: "user-a", courseId: "course-1" }))).toBe(true);
    expect(filter(owner({ userId: "user-a", courseId: "course-2" }))).toBe(false);
    expect(filter(owner({ userId: "user-a", courseId: null }))).toBe(false);
  });

  it("semester-resolved courseIds narrow results to chunks in one of those courses", () => {
    const filter = buildOwnershipFilter("user-a", { semesterId: "sem-1" }, ["course-1", "course-2"]);
    expect(filter(owner({ userId: "user-a", courseId: "course-1" }))).toBe(true);
    expect(filter(owner({ userId: "user-a", courseId: "course-3" }))).toBe(false);
    expect(filter(owner({ userId: "user-a", courseId: null }))).toBe(false);
  });

  it("still enforces ownership even when a semester's courseIds happen to match a different user's chunk", () => {
    const filter = buildOwnershipFilter("user-a", { semesterId: "sem-1" }, ["course-1"]);
    expect(filter(owner({ userId: "user-b", courseId: "course-1" }))).toBe(false);
  });
});
