import type { ReactNode } from "react";
import { requireUserId, getSession } from "@/lib/dal";
import { DashboardShell } from "./sign-out-button";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireUserId();
  const session = await getSession();

  return <DashboardShell userName={session?.user?.name ?? null}>{children}</DashboardShell>;
}
