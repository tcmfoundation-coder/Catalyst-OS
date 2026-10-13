import { describe, expect, it } from "vitest";
import {
  createMobileSessionToken,
  hashMobileSessionToken,
  readBearerToken,
} from "./session-token";

describe("mobile session tokens", () => {
  it("creates an opaque token with enough random material", () => {
    const first = createMobileSessionToken();
    const second = createMobileSessionToken();

    expect(first).toMatch(/^cat_mob_[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("hashes a token deterministically without returning the token", () => {
    const token = createMobileSessionToken();
    const hash = hashMobileSessionToken(token);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashMobileSessionToken(token)).toBe(hash);
  });

  it("accepts only a complete bearer token", () => {
    const token = createMobileSessionToken();

    expect(readBearerToken(`Bearer ${token}`)).toBe(token);
    expect(readBearerToken(`bearer ${token}`)).toBe(token);
    expect(readBearerToken(`Bearer ${token} trailing`)).toBeNull();
    expect(readBearerToken("Basic credentials")).toBeNull();
    expect(readBearerToken(null)).toBeNull();
  });
});
