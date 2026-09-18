import { MATERIAL_STATUS_LABELS, type MaterialStatus } from "@/lib/study-materials/constants";

const STYLES: Record<MaterialStatus, string> = {
  uploaded: "bg-slate-100 text-slate-600",
  processing: "bg-sky-50 text-sky-700",
  ready: "bg-emerald-50 text-emerald-700",
  needs_ocr: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
};

export function MaterialStatusBadge({ status }: { status: MaterialStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {MATERIAL_STATUS_LABELS[status]}
    </span>
  );
}
