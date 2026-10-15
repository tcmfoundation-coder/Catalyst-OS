import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateMobileRequest } from "@/lib/mobile/auth";
import { mobileApiHeaders, mobileApiOptions } from "@/lib/mobile/cors";
import { connectToDatabase } from "@/lib/db";
import { StudyMaterial } from "@/models/StudyMaterial";
import { confirmMaterialUploadForUser, requestMaterialUploadUrlForUser, retryMaterialProcessingForUser } from "@/lib/actions/study-materials";

export function OPTIONS(request: Request) { return mobileApiOptions(request); }
export async function GET(request: Request) {
  const headers = mobileApiHeaders(request), principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });
  await connectToDatabase();
  const materials = await StudyMaterial.find({ userId: principal.userId }).sort({ createdAt: -1 }).populate("courseId", "code title").lean();
  return NextResponse.json(materials.map(m => ({ id: m._id.toString(), filename: m.originalFilename, format: m.format, sizeBytes: m.fileSizeBytes, status: m.status, processingError: m.processingError, title: m.title, courseId: m.courseId && "_id" in m.courseId ? m.courseId._id.toString() : null, courseCode: m.courseId && "code" in m.courseId ? m.courseId.code : null, createdAt: m.createdAt.toISOString() })), { headers });
}
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("requestUpload"), filename: z.string(), sizeBytes: z.number(), courseId: z.string().default("") }),
  z.object({ action: z.literal("confirmUpload"), storageKey: z.string(), originalFilename: z.string(), courseId: z.string().default("") }),
  z.object({ action: z.literal("retryProcessing"), materialId: z.string() }),
]);
export async function POST(request: Request) {
  const headers = mobileApiHeaders(request), principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid upload" }, { status: 400, headers });
  const result = parsed.data.action === "requestUpload"
    ? await requestMaterialUploadUrlForUser(principal.userId, parsed.data)
    : parsed.data.action === "confirmUpload"
      ? await confirmMaterialUploadForUser(principal.userId, parsed.data)
      : await retryMaterialProcessingForUser(principal.userId, parsed.data.materialId);
  if ("error" in result) return NextResponse.json(result, { status: 400, headers });
  return NextResponse.json(result, { headers });
}
