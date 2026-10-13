import { createHash, randomBytes } from "node:crypto";

export const MOBILE_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Create a 256-bit opaque token. Only its SHA-256 hash is persisted. */
export function createMobileSessionToken(): string {
  return `cat_mob_${randomBytes(32).toString("base64url")}`;
}

export function hashMobileSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function readBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(cat_mob_[A-Za-z0-9_-]{43})$/i.exec(header.trim());
  return match?.[1] ?? null;
}
