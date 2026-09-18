import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Reads the session once per request (memoized) so every Server Component,
 * Server Action, and Route Handler that needs the current user shares one
 * lookup instead of re-verifying independently.
 */
export const getSession = cache(async () => {
  return getServerSession(authOptions);
});

/** Redirects unauthenticated requests to /login. Use in protected pages/actions. */
export async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user.id;
}
