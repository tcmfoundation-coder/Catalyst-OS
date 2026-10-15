import { NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobile/auth";
import { mobileApiHeaders, mobileApiOptions } from "@/lib/mobile/cors";
import { listStudyResources } from "@/lib/study-resources/resources";
import { generateStudyNotes } from "@/lib/study-resources/service";

export function OPTIONS(request: Request) { return mobileApiOptions(request); }
export async function GET(request: Request) {
  const headers = mobileApiHeaders(request), principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });
  return NextResponse.json(await listStudyResources(principal.userId, { type: "notes" }), { headers });
}
export async function POST(request: Request) {
  const headers = mobileApiHeaders(request), principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });
  const result = await generateStudyNotes(principal.userId, await request.json().catch(() => null));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400, headers });
  return NextResponse.json(result, { headers });
}
