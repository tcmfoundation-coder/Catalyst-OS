import "server-only";
import { rm } from "node:fs/promises";
import path from "node:path";
import { connectToDatabase } from "@/lib/db";
import { StudyMaterial } from "@/models/StudyMaterial";
import { MaterialChunk } from "@/models/MaterialChunk";
import { downloadToTempFile } from "@/lib/storage/s3";
import { runDocumentProcessor } from "./processor-runner";

/**
 * Downloads the material's file, runs it through the Python processor, and
 * persists the result. Called (but not awaited) right after
 * confirmMaterialUpload creates the material, so it keeps running after
 * that action's HTTP response has already gone back to the browser.
 *
 * That's safe here because this Next.js process is long-running (not a
 * serverless function that gets frozen once a response is sent) and
 * because there is exactly one such job at a time per upload — there's no
 * queue because nothing here needs one yet. If materials ever needed to
 * survive a server restart mid-processing, or needed to run on a separate
 * worker, that's the point where a real queue would earn its complexity.
 */
export async function processStudyMaterial(materialId: string): Promise<void> {
  await connectToDatabase();

  const material = await StudyMaterial.findById(materialId);
  if (!material) return;

  material.status = "processing";
  material.processingError = null;
  await material.save();

  let tempFilePath: string | null = null;
  try {
    tempFilePath = await downloadToTempFile(material.storageKey, `.${material.format}`);

    const result = await runDocumentProcessor(tempFilePath, material.format);

    if (!result.ok) {
      material.status = "failed";
      material.processingError = result.error;
      await material.save();
      return;
    }

    if (result.requiresOcr) {
      material.status = "needs_ocr";
      await material.save();
      return;
    }

    // Idempotent: safe to re-run processing on the same material (e.g. a
    // future "reprocess" action) without accumulating duplicate chunks.
    await MaterialChunk.deleteMany({ materialId: material._id });
    if (result.chunks.length > 0) {
      await MaterialChunk.insertMany(
        result.chunks.map((chunk) => ({
          materialId: material._id,
          userId: material.userId,
          courseId: material.courseId,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          heading: chunk.heading,
          pageStart: chunk.pageStart,
          pageEnd: chunk.pageEnd,
          slideStart: chunk.slideStart,
          slideEnd: chunk.slideEnd,
        })),
      );
    }

    material.status = "ready";
    material.title = result.metadata.title;
    material.pageCount = result.metadata.pageCount;
    material.slideCount = result.metadata.slideCount;
    await material.save();
  } catch (error) {
    material.status = "failed";
    material.processingError = error instanceof Error ? error.message : "Unknown processing error";
    await material.save();
  } finally {
    if (tempFilePath) {
      await rm(path.dirname(tempFilePath), { recursive: true, force: true }).catch(() => {});
    }
  }
}
