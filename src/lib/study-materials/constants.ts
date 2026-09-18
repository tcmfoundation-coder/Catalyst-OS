import { randomUUID } from "node:crypto";

export const MATERIAL_FORMATS = ["pdf", "docx", "pptx"] as const;
export type MaterialFormat = (typeof MATERIAL_FORMATS)[number];

export const FORMAT_MIME_TYPES: Record<MaterialFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export const FORMAT_LABELS: Record<MaterialFormat, string> = {
  pdf: "PDF",
  docx: "Word document",
  pptx: "PowerPoint presentation",
};

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export const MATERIAL_STATUSES = ["uploaded", "processing", "ready", "needs_ocr", "failed"] as const;
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

export const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  uploaded: "Uploaded",
  processing: "Processing",
  ready: "Ready",
  needs_ocr: "Needs OCR",
  failed: "Failed",
};

export function isMaterialFormat(value: string): value is MaterialFormat {
  return (MATERIAL_FORMATS as readonly string[]).includes(value);
}

/**
 * The format is decided from the file's extension, not any mime type the
 * client claims — see storage/s3.ts's createUploadUrl comment for why a
 * client-supplied Content-Type can't be trusted. The extension is just a
 * string we compare against a 3-item allowlist, so there's no injection
 * risk in using it directly.
 */
export function formatFromFilename(filename: string): MaterialFormat | null {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename.trim());
  const extension = match ? match[1].toLowerCase() : "";
  return isMaterialFormat(extension) ? extension : null;
}

const OBJECT_ID_PATTERN = "[a-f0-9]{24}";
const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const STORAGE_KEY_PATTERN = new RegExp(
  `^materials/(${OBJECT_ID_PATTERN})/(${UUID_PATTERN})\\.(${MATERIAL_FORMATS.join("|")})$`,
);

/**
 * Storage keys are namespaced as materials/{userId}/{uuid}.{format} and
 * only ever generated server-side (see below) — never accepted as
 * arbitrary client input. When a client later "confirms" an upload by
 * handing this key back, parseMaterialStorageKey (below) checks the
 * embedded userId matches the caller before we trust it belongs to them.
 */
export function buildMaterialStorageKey(userId: string, format: MaterialFormat): string {
  return `materials/${userId}/${randomUUID()}.${format}`;
}

export interface ParsedStorageKey {
  userId: string;
  format: MaterialFormat;
}

export function parseMaterialStorageKey(storageKey: string): ParsedStorageKey | null {
  const match = STORAGE_KEY_PATTERN.exec(storageKey);
  if (!match) return null;
  return { userId: match[1], format: match[3] as MaterialFormat };
}
