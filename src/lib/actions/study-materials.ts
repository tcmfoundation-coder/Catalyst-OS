"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { StudyMaterial } from "@/models/StudyMaterial";
import { MaterialChunk } from "@/models/MaterialChunk";
import { createUploadUrl, deleteObject, headObject } from "@/lib/storage/s3";
import {
  FORMAT_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  buildMaterialStorageKey,
  formatFromFilename,
  parseMaterialStorageKey,
} from "@/lib/study-materials/constants";
import { ConfirmUploadInputSchema, RequestUploadInputSchema } from "@/lib/study-materials/validation";
import { processStudyMaterial } from "@/lib/study-materials/processing";
import { removeChunkVector } from "@/lib/retrieval/index-manager";
import { courseBelongsToUser } from "./course-ownership";

export type UploadUrlResult =
  | { error: string }
  | { uploadUrl: string; storageKey: string; contentType: string };

export type ConfirmUploadResult = { error: string } | { materialId: string };
export type RetryProcessingResult = { ok: true } | { ok: false; error: string };

export async function retryMaterialProcessingForUser(userId: string, materialId: string): Promise<RetryProcessingResult> {
  if (!Types.ObjectId.isValid(materialId)) return { ok: false, error: "Material not found" };
  await connectToDatabase();
  const material = await StudyMaterial.findOneAndUpdate(
    { _id: materialId, userId, status: "failed" },
    { $set: { status: "uploaded", processingError: null } },
    { new: true },
  ).select("_id");
  if (!material) return { ok: false, error: "This material is not available to retry" };
  const id = material._id.toString();
  processStudyMaterial(id).catch((error: unknown) => console.error(`Background retry crashed for material ${id}:`, error));
  return { ok: true };
}

export async function retryMaterialProcessing(materialId: string): Promise<RetryProcessingResult> {
  const userId = await requireUserId();
  const result = await retryMaterialProcessingForUser(userId, materialId);
  if (result.ok) revalidatePath("/dashboard/materials");
  return result;
}

/** Mobile bearer-authenticated API uses the same validation and storage policy. */
export async function requestMaterialUploadUrlForUser(userId: string, input: {
  filename: string; sizeBytes: number; courseId: string;
}): Promise<UploadUrlResult> {
  const parsed = RequestUploadInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const format = formatFromFilename(parsed.data.filename);
  if (!format) return { error: "Only PDF, DOCX, and PPTX files are supported" };
  await connectToDatabase();
  if (parsed.data.courseId && !(await courseBelongsToUser(parsed.data.courseId, userId))) return { error: "Course not found" };
  const storageKey = buildMaterialStorageKey(userId, format);
  const contentType = FORMAT_MIME_TYPES[format];
  return { uploadUrl: await createUploadUrl(storageKey, contentType), storageKey, contentType };
}

export async function confirmMaterialUploadForUser(userId: string, input: {
  storageKey: string; originalFilename: string; courseId: string;
}): Promise<ConfirmUploadResult> {
  const parsed = ConfirmUploadInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const keyInfo = parseMaterialStorageKey(parsed.data.storageKey);
  if (!keyInfo || keyInfo.userId !== userId) return { error: "Invalid or unrecognized upload" };
  if (formatFromFilename(parsed.data.originalFilename) !== keyInfo.format) {
    return { error: "The selected file type does not match the upload" };
  }
  await connectToDatabase();
  if (parsed.data.courseId && !(await courseBelongsToUser(parsed.data.courseId, userId))) return { error: "Course not found" };

  // Confirmation may be retried after a mobile connection timeout even
  // though the first request already created the material and started its
  // processor. Reuse that record instead of creating duplicate work.
  const existing = await StudyMaterial.findOne({ userId, storageKey: parsed.data.storageKey }).select("_id").lean();
  if (existing) return { materialId: existing._id.toString() };

  const head = await headObject(parsed.data.storageKey);
  if (!head) return { error: "Upload not found in storage — please try again" };
  if (head.sizeBytes < 1) {
    await deleteObject(parsed.data.storageKey).catch(() => {});
    return { error: "The uploaded file is empty" };
  }
  if (head.sizeBytes > MAX_UPLOAD_BYTES) {
    await deleteObject(parsed.data.storageKey).catch(() => {});
    return { error: "File is larger than the 25MB limit" };
  }
  let material;
  try {
    material = await StudyMaterial.create({ userId, courseId: parsed.data.courseId || null,
      originalFilename: parsed.data.originalFilename, format: keyInfo.format, fileSizeBytes: head.sizeBytes,
      storageKey: parsed.data.storageKey, status: "uploaded" });
  } catch (error) {
    // Two confirmations can race after both observe no existing record.
    // The unique storageKey index decides the winner; the loser returns it.
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      const winner = await StudyMaterial.findOne({ userId, storageKey: parsed.data.storageKey }).select("_id").lean();
      if (winner) return { materialId: winner._id.toString() };
    }
    throw error;
  }
  const materialId = material._id.toString();
  processStudyMaterial(materialId).catch((error: unknown) => console.error(`Background processing crashed for material ${materialId}:`, error));
  return { materialId };
}

export async function requestMaterialUploadUrl(input: {
  filename: string;
  sizeBytes: number;
  courseId: string;
}): Promise<UploadUrlResult> {
  const userId = await requireUserId();

  const parsed = RequestUploadInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const format = formatFromFilename(parsed.data.filename);
  if (!format) {
    return { error: "Only PDF, DOCX, and PPTX files are supported" };
  }

  await connectToDatabase();

  if (!(await courseBelongsToUser(parsed.data.courseId, userId))) {
    return { error: "Course not found" };
  }

  const storageKey = buildMaterialStorageKey(userId, format);
  const contentType = FORMAT_MIME_TYPES[format];
  const uploadUrl = await createUploadUrl(storageKey, contentType);

  return { uploadUrl, storageKey, contentType };
}

export async function confirmMaterialUpload(input: {
  storageKey: string;
  originalFilename: string;
  courseId: string;
}): Promise<ConfirmUploadResult> {
  const userId = await requireUserId();

  const parsed = ConfirmUploadInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // The storage key was generated by requestMaterialUploadUrl above and
  // only ever echoed back by the client — this check is what stops a
  // client from "confirming" a key that isn't actually theirs.
  const keyInfo = parseMaterialStorageKey(parsed.data.storageKey);
  if (!keyInfo || keyInfo.userId !== userId) {
    return { error: "Invalid or unrecognized upload" };
  }
  if (formatFromFilename(parsed.data.originalFilename) !== keyInfo.format) {
    return { error: "The selected file type does not match the upload" };
  }

  await connectToDatabase();

  if (parsed.data.courseId && !(await courseBelongsToUser(parsed.data.courseId, userId))) {
    return { error: "Course not found" };
  }

  const existing = await StudyMaterial.findOne({ userId, storageKey: parsed.data.storageKey }).select("_id").lean();
  if (existing) return { materialId: existing._id.toString() };

  // Never trust the size the browser claimed when requesting the upload
  // URL — this is the real, storage-verified size of what actually landed.
  const head = await headObject(parsed.data.storageKey);
  if (!head) {
    return { error: "Upload not found in storage — please try again" };
  }
  if (head.sizeBytes < 1) {
    await deleteObject(parsed.data.storageKey).catch(() => {});
    return { error: "The uploaded file is empty" };
  }
  if (head.sizeBytes > MAX_UPLOAD_BYTES) {
    await deleteObject(parsed.data.storageKey).catch(() => {});
    return { error: "File is larger than the 25MB limit" };
  }

  let material;
  try {
    material = await StudyMaterial.create({
      userId,
      courseId: parsed.data.courseId ? new Types.ObjectId(parsed.data.courseId) : null,
      originalFilename: parsed.data.originalFilename,
      format: keyInfo.format,
      fileSizeBytes: head.sizeBytes,
      storageKey: parsed.data.storageKey,
      status: "uploaded",
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      const winner = await StudyMaterial.findOne({ userId, storageKey: parsed.data.storageKey }).select("_id").lean();
      if (winner) return { materialId: winner._id.toString() };
    }
    throw error;
  }

  const materialId = material._id.toString();
  // Deliberately not awaited — see processing.ts's docstring for why that's
  // safe in this app's deployment shape.
  processStudyMaterial(materialId).catch((error: unknown) => {
    console.error(`Background processing crashed for material ${materialId}:`, error);
  });

  revalidatePath("/dashboard/materials");

  return { materialId };
}

export async function deleteMaterial(materialId: string): Promise<void> {
  const userId = await requireUserId();
  await connectToDatabase();

  const material = await StudyMaterial.findOneAndDelete({ _id: materialId, userId });
  if (!material) return;

  // Vector labels must be invalidated in the index before the chunks that
  // own them are gone from MongoDB — otherwise a concurrent index rebuild
  // reading MongoDB mid-delete could race, and there'd be no record left
  // of which labels needed removing.
  const chunksToRemove = await MaterialChunk.find({ materialId: material._id }, { vectorLabel: 1 }).lean();
  await Promise.all(
    chunksToRemove
      .filter((chunk) => chunk.vectorLabel != null)
      .map((chunk) =>
        removeChunkVector(chunk.vectorLabel as number).catch((error: unknown) => {
          console.error(`Failed to remove vector for label ${chunk.vectorLabel}:`, error);
        }),
      ),
  );

  await MaterialChunk.deleteMany({ materialId: material._id });
  await deleteObject(material.storageKey).catch((error: unknown) => {
    console.error(`Failed to delete object ${material.storageKey} from storage:`, error);
  });

  revalidatePath("/dashboard/materials");
}
