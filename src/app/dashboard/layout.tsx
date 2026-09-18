import type { ReactNode } from "react";
import Link from "next/link";
import { requireUserId, getSession } from "@/lib/dal";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireUserId();
  const session = await getSession();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-slate-900">
            Catalysts
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">
              Overview
            </Link>
            <Link
              href="/dashboard/academic-years"
              className="text-slate-600 hover:text-slate-900"
            >
              Academics
            </Link>
            <Link href="/dashboard/tasks" className="text-slate-600 hover:text-slate-900">
              Tasks
            </Link>
            <Link
              href="/dashboard/study-sessions"
              className="text-slate-600 hover:text-slate-900"
            >
              Study
            </Link>
            <Link href="/dashboard/habits" className="text-slate-600 hover:text-slate-900">
              Habits
            </Link>
            {session?.user?.name && (
              <span className="hidden text-slate-400 sm:inline">{session.user.name}</span>
            )}
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
