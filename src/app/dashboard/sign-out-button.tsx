"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CatalystLogo } from "@/components/brand/catalyst-logo";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { AIHub } from "@/components/ai-hub/ai-hub";

const DESTINATIONS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/academic-years", label: "Academics" },
  { href: "/dashboard/tasks", label: "Tasks" },
  { href: "/dashboard/study-sessions", label: "Study" },
  { href: "/dashboard/habits", label: "Habits" },
  { href: "/dashboard/memories", label: "Memories" },
  { href: "/dashboard/materials", label: "Materials" },
  { href: "/dashboard/tutor", label: "Tutor" },
  { href: "/dashboard/study-notes", label: "Study Notes" },
  { href: "/dashboard/settings/ai", label: "AI Settings" },
] as const;

const SIDEBAR_GROUPS = [
  { label: "Command", hrefs: ["/dashboard"] },
  { label: "Academics", hrefs: ["/dashboard/academic-years"] },
  { label: "Operations", hrefs: ["/dashboard/tasks", "/dashboard/study-sessions", "/dashboard/habits"] },
  { label: "Intelligence", hrefs: ["/dashboard/memories", "/dashboard/materials"] },
  { label: "Systems", hrefs: ["/dashboard/tutor", "/dashboard/study-notes"] },
  { label: "Preferences", hrefs: ["/dashboard/settings/ai"] },
] as const;

const PRIMARY_HREFS = [
  "/dashboard",
  "/dashboard/tasks",
  "/dashboard/study-sessions",
  "/dashboard/tutor",
] as const;

const MORE_HREFS = DESTINATIONS.filter(
  (item) => !PRIMARY_HREFS.includes(item.href as (typeof PRIMARY_HREFS)[number]),
).map((item) => item.href);

function destinationByHref(href: string) {
  return DESTINATIONS.find((item) => item.href === href);
}

function pathIsActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  if (href === "/dashboard/academic-years") {
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      pathname.startsWith("/dashboard/semesters")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function SignOutButton({ className = "" }: { className?: string } = {}) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-line px-3 text-sm text-muted transition-colors duration-150 hover:border-danger/50 hover:text-foreground ${focusRing} ${className}`}
    >
      Sign out
    </button>
  );
}

export function DashboardShell({
  userName,
  children,
}: {
  userName: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreTitleId = useId();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_HREFS.some((href) => pathIsActive(pathname, href));

  function closeMore() {
    dialogRef.current?.close();
  }

  function openMore() {
    dialogRef.current?.showModal();
  }

  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  return (
    <div className="dashboard-theme flex h-dvh overflow-hidden lg:h-auto lg:min-h-dvh lg:overflow-visible">
      <a
        href="#main-content"
        className={`sr-only z-50 bg-surface px-3 py-2 text-sm text-foreground focus:not-sr-only focus:absolute focus:left-3 focus:top-3 ${focusRing}`}
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-line px-5">
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 text-sm font-semibold tracking-[0.18em] text-foreground uppercase ${focusRing}`}
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent/35 bg-accent/10 shadow-[0_0_18px_rgba(165,243,75,0.1)]">
              <CatalystLogo className="h-7 w-7 p-0.5" />
            </span>
            <span>Catalysts<span className="ml-1 text-accent">OS</span></span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Dashboard">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.label} className="mb-5 last:mb-0">
              <p className="px-2 pb-2 text-[10px] font-medium tracking-[0.16em] text-muted uppercase">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.hrefs.map((href) => {
                  const item = destinationByHref(href);
                  if (!item) return null;
                  return (
                    <li key={href}>
                      <SidebarLink href={item.href} pathname={pathname}>
                        {item.label}
                      </SidebarLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          <div className="mb-3 flex items-center gap-2 font-mono text-[9px] tracking-[0.16em] text-accent/80 uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> System online
          </div>
          {userName && (
            <p className="mb-2 truncate px-1 text-xs text-muted" title={userName}>
              {userName}
            </p>
          )}
          <SignOutButton className="w-full" />
        </div>
      </aside>

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col lg:h-auto lg:min-h-dvh">
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-3 pt-[env(safe-area-inset-top,0px)] lg:min-h-16 lg:px-6">
          <Link
            href="/dashboard"
            className={`flex items-center gap-2 py-2 text-sm font-semibold tracking-[0.18em] text-foreground uppercase lg:hidden ${focusRing}`}
          >
            <span className="grid h-7 w-7 place-items-center rounded-md border border-accent/35 bg-accent/10">
              <CatalystLogo className="h-6 w-6 p-0.5" />
            </span>
            Catalysts<span className="text-accent">OS</span>
          </Link>
          <p className="hidden font-mono text-[10px] tracking-[0.2em] text-muted uppercase lg:block">
            Command deck <span className="text-accent">/ 01</span>
          </p>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden items-center gap-2 font-mono text-[9px] tracking-wider text-accent uppercase sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_#a5f34b]" /> Online
            </span>
            {userName && (
              <span className="hidden truncate text-sm text-muted sm:inline">{userName}</span>
            )}
            <div className="lg:hidden">
              <SignOutButton />
            </div>
          </div>
        </header>

        <main
          id="main-content"
          className="mx-auto w-full min-h-0 max-w-7xl flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:overflow-visible lg:px-8 lg:py-8"
        >
          {children}
        </main>

        <nav
          className="shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
          aria-label="Primary"
        >
          <ul className="flex">
            {PRIMARY_HREFS.map((href) => {
              const item = destinationByHref(href);
              if (!item) return null;
              const active = pathIsActive(pathname, href);
              return (
                <li key={href} className="min-w-0 flex-1">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    title={item.label}
                    className={`flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-tight font-medium transition-colors duration-150 ${focusRing} ${
                      active ? "text-accent" : "text-muted hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`h-0.5 w-4 rounded-full ${active ? "bg-accent" : "bg-transparent"}`}
                      aria-hidden="true"
                    />
                    <span className="max-w-full truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
            <li className="min-w-0 flex-1">
              <button
                ref={moreButtonRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                aria-controls="command-more"
                onClick={openMore}
                className={`flex min-h-11 w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-tight font-medium transition-colors duration-150 ${focusRing} ${
                  moreActive ? "text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                <span
                  className={`h-0.5 w-4 rounded-full ${moreActive ? "bg-accent" : "bg-transparent"}`}
                  aria-hidden="true"
                />
                More
              </button>
            </li>
          </ul>
        </nav>
      </div>

      <dialog
        ref={dialogRef}
        id="command-more"
        className="command-more"
        aria-labelledby={moreTitleId}
        onClose={() => {
          setMoreOpen(false);
          moreButtonRef.current?.focus();
        }}
        onToggle={(event) => {
          setMoreOpen(event.currentTarget.open);
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            closeMore();
          }
        }}
      >
        <div className="rounded-t-lg border-t border-line bg-surface-raised px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id={moreTitleId} className="text-sm font-medium tracking-[0.12em] text-foreground uppercase">
              More
            </h2>
            <button
              type="button"
              onClick={closeMore}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-sm text-muted transition-colors duration-150 hover:text-foreground ${focusRing}`}
            >
              Close
            </button>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {MORE_HREFS.map((href) => {
              const item = destinationByHref(href);
              if (!item) return null;
              const active = pathIsActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center text-sm transition-colors duration-150 ${focusRing} ${
                      active ? "text-accent" : "text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </dialog>

      <AIHub />
    </div>
  );
}

function SidebarLink({
  href,
  pathname,
  children,
}: {
  href: string;
  pathname: string;
  children: ReactNode;
}) {
  const active = pathIsActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-11 items-center rounded-md px-3 text-sm transition-colors duration-150 ${focusRing} ${
        active
          ? "bg-accent-dim text-foreground"
          : "text-muted hover:bg-surface-raised hover:text-foreground"
      }`}
    >
      <span
        className={`absolute top-2 bottom-2 left-0 w-0.5 rounded-full ${active ? "bg-accent" : "bg-transparent"}`}
        aria-hidden="true"
      />
      {children}
    </Link>
  );
}
