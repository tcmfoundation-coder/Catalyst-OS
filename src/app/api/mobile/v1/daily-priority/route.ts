import { NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobile/auth";
import { recommendDailyPriority } from "@/lib/dashboard/daily-priority";
import { mobileApiHeaders, mobileApiOptions } from "@/lib/mobile/cors";

export function OPTIONS(request: Request) {
  return mobileApiOptions(request);
}

export async function POST(request: Request) {
  const headers = mobileApiHeaders(request);
  headers.set("Cache-Control", "no-store");
  const principal = await authenticateMobileRequest(request);
  if (!principal) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });
  }

  const result = await recommendDailyPriority(principal.userId);
  return NextResponse.json(result, { status: result.ok ? 200 : 503, headers });
}
