import Link from "next/link";
import type { Types } from "mongoose";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { StudyMaterial, type IStudyMaterial } from "@/models/StudyMaterial";
import { FORMAT_LABELS } from "@/lib/study-materials/constants";
import { MaterialStatusBadge } from "../material-status-badge";
import { DeleteMaterialButton } from "../delete-material-button";
import { ProcessingPoller } from "../processing-poller";
import { formatFileSize } from "../format-file-size";

interface MaterialLean {
  _id: Types.ObjectId;
  originalFilename: string;
  format: IStudyMaterial["format"];
  fileSizeBytes: number;
  status: IStudyMaterial["status"];
  courseId: { _id: Types.ObjectId; code: string } | null;
}

export default async function MaterialsPage() {
  const userId = await requireUserId();
  await connectToDatabase();

  const materials = await StudyMaterial.find({ userId })
    .populate("courseId", "code")
    .sort({ createdAt: -1 })
    .lean<MaterialLean[]>();

  const hasInFlight = materials.some((m) => m.status === "uploaded" || m.status === "processing");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Study materials</h1>
        <Link
          href="/dashboard/materials/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          Upload material
        </Link>
      </div>

      {hasInFlight && <ProcessingPoller />}

      {materials.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">No study materials yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Upload a PDF, Word document, or PowerPoint presentation to start building your
            knowledge base.
          </p>
          <Link
            href="/dashboard/materials/new"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Upload your first material
          </Link>
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="space-y-3">
            {materials.map((material) => (
              <div
                key={material._id.toString()}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/materials/${material._id.toString()}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {material.originalFilename}
                    </Link>
                    <MaterialStatusBadge status={material.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {FORMAT_LABELS[material.format]} · {formatFileSize(material.fileSizeBytes)}
                    {material.courseId && <> · {material.courseId.code}</>}
                  </p>
                </div>
                <DeleteMaterialButton materialId={material._id.toString()} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
