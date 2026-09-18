"use client";

import { deleteMaterial } from "@/lib/actions/study-materials";

export function DeleteMaterialButton({ materialId }: { materialId: string }) {
  return (
    <form action={deleteMaterial.bind(null, materialId)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Delete
      </button>
    </form>
  );
}
