import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateMobileRequest } from "@/lib/mobile/auth";
import {
  createMobileSessionToken,
  hashMobileSessionToken,
  MOBILE_SESSION_TTL_MS,
} from "@/lib/mobile/session-token";
import { connectToDatabase } from "@/lib/db";
import { MobileSession } from "@/models/MobileSession";
import { User } from "@/models/User";
import { mobileApiHeaders, mobileApiOptions } from "@/lib/mobile/cors";

const CredentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export function OPTIONS(request: Request) {
  return mobileApiOptions(request);
}

export async function POST(request: Request) {
  const headers = mobileApiHeaders(request);
  const body = await request.json().catch(() => null);
  const credentials = CredentialsSchema.safeParse(body);
  if (!credentials.success) {
    return NextResponse.json({ error: "Enter a valid email and password" }, { status: 400, headers });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: credentials.data.email.trim().toLowerCase() }).select(
    "+passwordHash name email",
  );
  const validPassword = user
    ? await bcrypt.compare(credentials.data.password, user.passwordHash)
    : false;

  if (!user || !validPassword) {
    return NextResponse.json({ error: "Email or password is incorrect" }, { status: 401, headers });
  }

  const token = createMobileSessionToken();
  const expiresAt = new Date(Date.now() + MOBILE_SESSION_TTL_MS);
  await MobileSession.create({
    userId: user._id,
    tokenHash: hashMobileSessionToken(token),
    expiresAt,
  });

  return NextResponse.json(
    {
      token,
      expiresAt: expiresAt.toISOString(),
      user: { id: user._id.toString(), name: user.name, email: user.email },
    },
    { status: 201, headers },
  );
}

export async function GET(request: Request) {
  const headers = mobileApiHeaders(request);
  const principal = await authenticateMobileRequest(request);
  if (!principal) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });
  }

  const user = await User.findById(principal.userId).select("name email").lean();
  if (!user) {
    await MobileSession.deleteOne({ _id: principal.sessionId });
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });
  }

  return NextResponse.json(
    { user: { id: user._id.toString(), name: user.name, email: user.email } },
    { headers },
  );
}

export async function DELETE(request: Request) {
  const headers = mobileApiHeaders(request);
  const principal = await authenticateMobileRequest(request);
  if (!principal) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });
  }

  await MobileSession.deleteOne({ _id: principal.sessionId, userId: principal.userId });
  return new Response(null, { status: 204, headers });
}
