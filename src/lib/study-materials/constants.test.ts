import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildMaterialStorageKey,
  formatFromFilename,
  isMaterialFormat,
  parseMaterialStorageKey,
} from "./constants";

describe("formatFromFilename", () => {
  it("recognizes each supported extension, case-insensitively", () => {
    expect(formatFromFilename("notes.pdf")).toBe("pdf");
    expect(formatFromFilename("notes.PDF")).toBe("pdf");
    expect(formatFromFilename("essay.docx")).toBe("docx");
    expect(formatFromFilename("slides.pptx")).toBe("pptx");
  });

  it("returns null for an unsupported or missing extension", () => {
    expect(formatFromFilename("notes.txt")).toBeNull();
    expect(formatFromFilename("no-extension")).toBeNull();
    expect(formatFromFilename("archive.tar.gz")).toBeNull();
  });
});

describe("isMaterialFormat", () => {
  it("accepts the three supported formats and rejects anything else", () => {
    expect(isMaterialFormat("pdf")).toBe(true);
    expect(isMaterialFormat("docx")).toBe(true);
    expect(isMaterialFormat("pptx")).toBe(true);
    expect(isMaterialFormat("exe")).toBe(false);
    expect(isMaterialFormat("")).toBe(false);
  });
});

describe("buildMaterialStorageKey / parseMaterialStorageKey", () => {
  const userId = "507f1f77bcf86cd799439011"; // a valid-looking 24-hex ObjectId

  it("round-trips: a key built for a user parses back to that same user and format", () => {
    const key = buildMaterialStorageKey(userId, "pdf");
    expect(key).toMatch(/^materials\//);

    const parsed = parseMaterialStorageKey(key);
    expect(parsed).toEqual({ userId, format: "pdf" });
  });

  it("rejects a key claiming to belong to a different user's namespace", () => {
    const key = buildMaterialStorageKey("000000000000000000000001", "docx");
    const parsed = parseMaterialStorageKey(key);
    expect(parsed?.userId).not.toBe(userId);
  });

  it("rejects malformed or unexpected key shapes rather than guessing", () => {
    expect(parseMaterialStorageKey("not-a-real-key")).toBeNull();
    expect(parseMaterialStorageKey("materials/../../etc/passwd")).toBeNull();
    expect(parseMaterialStorageKey(`materials/${userId}/not-a-uuid.pdf`)).toBeNull();
    expect(parseMaterialStorageKey(`materials/${userId}/${randomUUID()}.exe`)).toBeNull();
  });
});
