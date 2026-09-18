import { notFound } from "next/navigation";
import Link from "next/link";
import type { Types } from "mongoose";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { StudyMaterial, type IStudyMaterial } from "@/models/StudyMaterial";
import { MaterialChunk } from "@/models/MaterialChunk";
import { createDownloadUrl } from "@/lib/storage/s3";
import { FORMAT_LABELS } from "@/lib/study-materials/constants";
import { MaterialStatusBadge } from "../material-status-badge";
import { DeleteMaterialButton } from "../delete-material-button";
import { formatFileSize } from "../format-file-size";

interface MaterialLean {
  _id: Types.ObjectId;
  originalFilename: string;
  format: IStudyMaterial["format"];
  fileSizeBytes: number;
  storageKey: string;
  status: IStudyMaterial["status"];
  processingError: string | null;
  pageCount: number | null;
  slideCount: number | null;
  courseId: { _id: Types.ObjectId; code: string; title: string } | null;
}

interface ChunkLean {
  _id: Types.ObjectId;
  chunkIndex: number;
  text: string;
  heading: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  slideStart: number | null;
  slideEnd: number | null;
}

function locationLabel(chunk: ChunkLean): string | null {
  if (chunk.pageStart !== null) {
    return chunk.pageStart === chunk.pageEnd
      ? `Page ${chunk.pageStart}`
      : `Pages ${chunk.pageStart}–${chunk.pageEnd}`;
  }
  if (chunk.slideStart !== null) {
    return chunk.slideStart === chunk.slideEnd
      ? `Slide ${chunk.slideStart}`
      : `Slides ${chunk.slideStart}–${chunk.slideEnd}`;
  }
  return null;
}

export default async function MaterialDetailPage({
  params,
}: PageProps<"/dashboard/materials/[id]">) {
  const userId = await requireUserId();
  const { id } = await params;
  await connectToDatabase();

  const material = await StudyMaterial.findOne({ _id: id, userId })
    .populate("courseId", "code title")
    .lean<MaterialLean>();

  if (!material) {
    notFound();
  }

  const chunks =
    material.status === "ready"
      ? await MaterialChunk.find({ materialId: id }).sort({ chunkIndex: 1 }).lean<ChunkLean[]>()
      : [];

  const downloadUrl = await createDownloadUrl(material.storageKey, material.originalFilename);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/materials" className="text-sm text-indigo-600 hover:underline">
          ← Study materials
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{material.originalFilename}</h1>
          <MaterialStatusBadge status={material.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {FORMAT_LABELS[material.format]} · {formatFileSize(material.fileSizeBytes)}
          {material.courseId && <> · {material.courseId.code}</>}
          {material.pageCount !== null && (
            <>
              {" "}
              · {material.pageCount} page{material.pageCount === 1 ? "" : "s"}
            </>
          )}
          {material.slideCount !== null && (
            <>
              {" "}
              · {material.slideCount} slide{material.slideCount === 1 ? "" : "s"}
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <a href={downloadUrl} className="text-sm font-medium text-indigo-600 hover:underline">
          Download original
        </a>
        <DeleteMaterialButton materialId={id} />
      </div>

      {material.status === "uploaded" || material.status === "processing" ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">
            Still processing this file. This page will update automatically.
          </p>
        </div>
      ) : material.status === "needs_ocr" ? (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
          <p className="text-sm text-amber-700">
            This PDF appears to be a scanned document with no extractable text. OCR support
            isn&apos;t available yet, so this material can&apos;t be turned into study chunks.
          </p>
        </div>
      ) : material.status === "failed" ? (
        <div className="rounded-2xl border border-dashed border-red-300 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">Processing failed</p>
          {material.processingError && (
            <p className="mt-1 text-sm text-red-600">{material.processingError}</p>
          )}
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Extracted content ({chunks.length} chunk{chunks.length === 1 ? "" : "s"})
          </h2>
          {chunks.length === 0 ? (
            <p className="text-sm text-slate-500">No text content was found in this document.</p>
          ) : (
            <div className="space-y-4">
              {chunks.map((chunk) => (
                <div
                  key={chunk._id.toString()}
                  className="border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    {chunk.heading && (
                      <span className="font-medium text-slate-600">{chunk.heading}</span>
                    )}
                    {locationLabel(chunk) && <span>{locationLabel(chunk)}</span>}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{chunk.text}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
