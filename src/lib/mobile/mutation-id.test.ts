import { describe, expect, it } from "vitest";
import { mobileMutationObjectId, readMobileMutationId } from "./mutation-id";

function requestWithMutationId(mutationId?: string) {
  return new Request("https://catalysts.example/api/mobile/v1/tasks", {
    headers: mutationId ? { "X-Catalysts-Mutation-Id": mutationId } : undefined,
  });
}

describe("mobile mutation IDs", () => {
  it("allows requests without an idempotency key", () => {
    expect(readMobileMutationId(requestWithMutationId())).toBeNull();
  });

  it("accepts and normalizes 12-byte hexadecimal IDs", () => {
    const mutationId = "ABCDEF0123456789ABCDEF01";
    const parsed = readMobileMutationId(requestWithMutationId(mutationId));

    expect(parsed).toBe(mutationId.toLowerCase());
    if (typeof parsed !== "string") throw new Error("Expected a valid mutation ID.");
    expect(mobileMutationObjectId(parsed)?.toString()).toBe(mutationId.toLowerCase());
  });

  it("rejects malformed IDs", () => {
    expect(readMobileMutationId(requestWithMutationId("short"))).toBe(false);
    expect(readMobileMutationId(requestWithMutationId("abcdefghijklmnopqrstuvwx"))).toBe(false);
  });
});
