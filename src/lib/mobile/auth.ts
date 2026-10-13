import "server-only";
import { connectToDatabase } from "@/lib/db";
import { hashMobileSessionToken, readBearerToken } from "@/lib/mobile/session-token";
import { MobileSession } from "@/models/MobileSession";

export interface MobilePrincipal {
  userId: string;
  sessionId: string;
}

export async function authenticateMobileRequest(request: Request): Promise<MobilePrincipal | null> {
  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) return null;

  await connectToDatabase();
  const session = await MobileSession.findOne({
    tokenHash: hashMobileSessionToken(token),
    expiresAt: { $gt: new Date() },
  })
    .select("userId")
    .lean();

  if (!session) return null;
  return { userId: session.userId.toString(), sessionId: session._id.toString() };
}
