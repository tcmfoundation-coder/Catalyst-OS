import "server-only";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_URL_EXPIRY_SECONDS = 300;
const DOWNLOAD_URL_EXPIRY_SECONDS = 300;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

// Cached the same way lib/db.ts caches its Mongoose connection: reused
// across hot-reloads in dev and across invocations in a long-running
// server, instead of building a new client per request.
declare global {
  var _s3Client: S3Client | undefined;
}

function getS3Client(): S3Client {
  if (!global._s3Client) {
    global._s3Client = new S3Client({
      region: process.env.S3_REGION ?? "us-east-1",
      endpoint: process.env.S3_ENDPOINT, // unset => real AWS S3
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true", // needed for MinIO/s3rver-style servers
      credentials: {
        accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
        secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
      },
    });
  }
  return global._s3Client;
}

function getBucket(): string {
  return requiredEnv("S3_BUCKET");
}

/**
 * A presigned PUT URL for the browser to upload directly to object storage.
 *
 * Important: a presigned PUT URL does NOT enforce that the browser sends
 * the same Content-Type we generated it for — verified this against a real
 * S3-compatible server, and a mismatched Content-Type was accepted. The
 * signature only covers the bucket/key/method, not arbitrary headers,
 * unless you go out of your way to add them to the signed header set. So
 * this is NOT a security boundary — don't trust the stored Content-Type as
 * proof of what the file actually is. The real gates are: (1) the actual
 * stored byte size, verified via headObject() after upload, since that
 * reflects real transferred bytes, not a claim, and (2) whether the Python
 * processor can actually parse the file as the format we tell it to try —
 * if someone uploads garbage or a mismatched file, extraction just fails
 * cleanly (status "failed"), which is the correct, safe outcome.
 */
export async function createUploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({ Bucket: getBucket(), Key: key, ContentType: contentType });
  return getSignedUrl(getS3Client(), command, { expiresIn: UPLOAD_URL_EXPIRY_SECONDS });
}

export interface ObjectHead {
  sizeBytes: number;
  contentType: string | null;
}

/** The real, server-verified metadata for an uploaded object — never trust what the client claims. */
export async function headObject(key: string): Promise<ObjectHead | null> {
  try {
    const result = await getS3Client().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return {
      sizeBytes: result.ContentLength ?? 0,
      contentType: result.ContentType ?? null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "NotFound") {
      return null;
    }
    throw error;
  }
}

/** A presigned GET URL so the browser can download the original file without our server proxying the bytes. */
export async function createDownloadUrl(key: string, downloadFilename: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ResponseContentDisposition: `attachment; filename="${downloadFilename.replace(/"/g, "")}"`,
  });
  return getSignedUrl(getS3Client(), command, { expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS });
}

export async function deleteObject(key: string): Promise<void> {
  await getS3Client().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

/**
 * Downloads an object to a local temp file and returns its path. This is
 * how the document processor gets access to a file — it only ever reads
 * local paths, never S3 directly (see lib/study-materials/processing.ts).
 * Callers must delete the returned file when done.
 */
export async function downloadToTempFile(key: string, suffix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "catalysts-material-"));
  const filePath = join(dir, `file${suffix}`);

  const result = await getS3Client().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
  const body = result.Body;
  if (!body || !("transformToWebStream" in body)) {
    await rm(dir, { recursive: true, force: true });
    throw new Error("Object storage returned no readable body");
  }

  try {
    const nodeStream = (await import("node:stream")).Readable.fromWeb(
      body.transformToWebStream() as import("node:stream/web").ReadableStream,
    );
    await pipeline(nodeStream, createWriteStream(filePath));
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }

  return filePath;
}
