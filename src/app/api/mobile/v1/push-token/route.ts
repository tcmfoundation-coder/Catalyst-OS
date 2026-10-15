import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateMobileRequest } from "@/lib/mobile/auth";
import { mobileApiHeaders, mobileApiOptions } from "@/lib/mobile/cors";
import { connectToDatabase } from "@/lib/db";
import { MobilePushToken } from "@/models/MobilePushToken";

const PushTokenInput = z.object({
  token: z.string().regex(/^(Expo|Exponent)PushToken\[[^\]]+\]$/),
  platform: z.enum(["android", "ios"]),
});

export function OPTIONS(request: Request) {
  return mobileApiOptions(request);
}

export async function POST(request: Request) {
  const headers = mobileApiHeaders(request);
  const principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });

  const parsed = PushTokenInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid device push token" }, { status: 400, headers });
  }

  await connectToDatabase();
  await MobilePushToken.findOneAndUpdate(
    { token: parsed.data.token },
    { userId: principal.userId, platform: parsed.data.platform, lastSeenAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return NextResponse.json({ ok: true }, { headers });
}

export async function DELETE(request: Request) {
  const headers = mobileApiHeaders(request);
  const principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });

  const parsed = z.object({ token: z.string() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid device push token" }, { status: 400, headers });
  }

  await connectToDatabase();
  await MobilePushToken.deleteOne({ userId: principal.userId, token: parsed.data.token });
  return new Response(null, { status: 204, headers });
}
