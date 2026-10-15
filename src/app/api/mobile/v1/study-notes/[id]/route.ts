import { NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobile/auth";
import { mobileApiHeaders, mobileApiOptions } from "@/lib/mobile/cors";
import { deleteStudyResource, getStudyResource } from "@/lib/study-resources/resources";
import { StudyNotesModelOutputSchema } from "@/lib/study-resources/notes-schema";

type Context = { params: Promise<{ id: string }> };
export function OPTIONS(request: Request) { return mobileApiOptions(request); }
export async function GET(request: Request, { params }: Context) {
  const headers = mobileApiHeaders(request), principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });
  const { id } = await params, resource = await getStudyResource(principal.userId, id);
  if (!resource || resource.type !== "notes") return NextResponse.json({ error: "Study notes not found" }, { status: 404, headers });
  const content = StudyNotesModelOutputSchema.safeParse(resource.content);
  if (!content.success) return NextResponse.json({ error: "Study notes could not be displayed" }, { status: 500, headers });
  return NextResponse.json({ ...resource, content: content.data }, { headers });
}
export async function DELETE(request: Request, { params }: Context) {
  const headers = mobileApiHeaders(request), principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });
  const { id } = await params, resource = await getStudyResource(principal.userId, id);
  if (!resource || resource.type !== "notes") return NextResponse.json({ error: "Study notes not found" }, { status: 404, headers });
  await deleteStudyResource(principal.userId, id);
  return NextResponse.json({ ok: true }, { headers });
}
