import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES } from "./constants";
import { ConfirmUploadInputSchema, RequestUploadInputSchema } from "./validation";

describe("RequestUploadInputSchema", () => {
  it("accepts a reasonable upload request", () => {
    const result = RequestUploadInputSchema.safeParse({
      filename: "lecture-notes.pdf",
      sizeBytes: "1048576",
      courseId: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty filename", () => {
    expect(
      RequestUploadInputSchema.safeParse({ filename: "", sizeBytes: "100", courseId: "" }).success,
    ).toBe(false);
  });

  it("rejects a file over the size limit", () => {
    const result = RequestUploadInputSchema.safeParse({
      filename: "big.pdf",
      sizeBytes: String(MAX_UPLOAD_BYTES + 1),
      courseId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zero-byte file", () => {
    const result = RequestUploadInputSchema.safeParse({
      filename: "empty.pdf",
      sizeBytes: "0",
      courseId: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("ConfirmUploadInputSchema", () => {
  it("accepts a well-formed confirmation", () => {
    const result = ConfirmUploadInputSchema.safeParse({
      storageKey: "materials/507f1f77bcf86cd799439011/uuid.pdf",
      originalFilename: "lecture-notes.pdf",
      courseId: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing storage key", () => {
    const result = ConfirmUploadInputSchema.safeParse({
      storageKey: "",
      originalFilename: "notes.pdf",
      courseId: "",
    });
    expect(result.success).toBe(false);
  });
});
