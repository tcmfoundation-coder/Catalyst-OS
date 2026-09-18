"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { requestMaterialUploadUrl, confirmMaterialUpload } from "@/lib/actions/study-materials";
import { FORMAT_LABELS, MATERIAL_FORMATS } from "@/lib/study-materials/constants";

interface CourseOption {
  id: string;
  label: string;
}

type Phase = "idle" | "requesting" | "uploading" | "confirming" | "error";

const ACCEPT = ".pdf,.docx,.pptx";

const inputClassName =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

/** Uploads directly to object storage via XHR so we get real byte-level progress events — not a simulated bar. */
function uploadWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export function UploadForm({ courses }: { courses: CourseOption[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [courseId, setCourseId] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const busy = phase === "requesting" || phase === "uploading" || phase === "confirming";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first");
      return;
    }

    setFileName(file.name);
    setPhase("requesting");

    const urlResult = await requestMaterialUploadUrl({
      filename: file.name,
      sizeBytes: file.size,
      courseId,
    });
    if ("error" in urlResult) {
      setError(urlResult.error);
      setPhase("error");
      return;
    }

    setPhase("uploading");
    setProgress(0);
    try {
      await uploadWithProgress(urlResult.uploadUrl, file, urlResult.contentType, setProgress);
    } catch {
      setError("Upload to storage failed. Please try again.");
      setPhase("error");
      return;
    }

    setPhase("confirming");
    const confirmResult = await confirmMaterialUpload({
      storageKey: urlResult.storageKey,
      originalFilename: file.name,
      courseId,
    });
    if ("error" in confirmResult) {
      setError(confirmResult.error);
      setPhase("error");
      return;
    }

    router.push(`/dashboard/materials/${confirmResult.materialId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="file" className="block text-sm font-medium text-slate-700">
          File
        </label>
        <input
          ref={fileInputRef}
          id="file"
          name="file"
          type="file"
          accept={ACCEPT}
          required
          disabled={busy}
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        <p className="mt-1 text-xs text-slate-400">
          {MATERIAL_FORMATS.map((format) => FORMAT_LABELS[format]).join(", ")} — up to 25MB
        </p>
      </div>

      <div>
        <label htmlFor="courseId" className="block text-sm font-medium text-slate-700">
          Course <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <select
          id="courseId"
          value={courseId}
          onChange={(event) => setCourseId(event.target.value)}
          disabled={busy}
          className={inputClassName}
        >
          <option value="">No course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.label}
            </option>
          ))}
        </select>
      </div>

      {phase === "requesting" && <p className="text-xs text-slate-500">Preparing upload...</p>}
      {phase === "uploading" && (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-indigo-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Uploading {fileName}... {progress}%
          </p>
        </div>
      )}
      {phase === "confirming" && <p className="text-xs text-slate-500">Starting processing...</p>}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? "Uploading..." : "Upload"}
        </button>
        <Link href="/dashboard/materials" className="text-sm text-slate-500 hover:text-slate-700">
          Cancel
        </Link>
      </div>
    </form>
  );
}
