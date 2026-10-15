import Link from "next/link";
import { CatalystLogo } from "@/components/brand/catalyst-logo";

export default function Home() {
  return (
    <main className="login-screen relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 sm:px-8 sm:py-10">
      <div aria-hidden="true" className="login-orbit login-orbit-one" />
      <div aria-hidden="true" className="login-orbit login-orbit-two" />

      <div className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0c1319]/90 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl lg:min-h-[650px] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="login-brand-panel relative flex flex-col justify-between overflow-hidden p-8 sm:p-12 xl:p-16">
          <div aria-hidden="true" className="login-grid absolute inset-0 opacity-60" />
          <div aria-hidden="true" className="login-planet-wrap absolute inset-0 hidden items-center justify-center lg:flex">
            <div className="login-planet-ring login-planet-ring-a" />
            <div className="login-planet-ring login-planet-ring-b" />
            <div className="login-planet" />
            <div className="login-planet-glow" />
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border border-[#b5f36f]/40 bg-[#b5f36f]/10 shadow-[0_0_28px_rgba(181,243,111,0.18)]">
              <CatalystLogo className="size-9" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.22em] text-white">CATALYSTS</p>
              <p className="mt-0.5 font-mono text-[9px] tracking-[0.2em] text-[#91a5af]">
                ACADEMIC OPERATING SYSTEM
              </p>
            </div>
          </div>

          <div className="relative z-10 max-w-xl py-14 lg:py-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#b5f36f]/20 bg-[#b5f36f]/[0.06] px-3 py-1.5 font-mono text-[10px] tracking-[0.16em] text-[#c5ff82]">
              <span className="size-1.5 rounded-full bg-[#b5f36f] shadow-[0_0_10px_#b5f36f]" />
              YOUR SPACE TO MAKE PROGRESS
            </div>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl xl:text-6xl">
              Bring your next big idea{" "}
              <span className="text-[#b5f36f]">into focus.</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-[#9aabb5] sm:text-base">
              A calmer command center for your courses, GPA, and study plans. Keep your academic
              life organized in one personal workspace.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="group flex h-14 items-center justify-center gap-2 rounded-xl bg-[#b5f36f] px-6 text-sm font-bold text-[#10170c] shadow-[0_0_28px_rgba(181,243,111,0.16)] transition hover:bg-[#c5ff82] hover:shadow-[0_0_36px_rgba(181,243,111,0.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b5f36f]"
              >
                Get started
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
              <Link
                href="/login"
                className="flex h-14 items-center justify-center rounded-xl border border-[#42535e] bg-[#111b23]/80 px-6 text-sm font-semibold text-[#e7eef1] transition hover:border-[#b5f36f]/60 hover:bg-[#15221d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b5f36f]"
              >
                Sign in
              </Link>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-3 font-mono text-[9px] tracking-[0.15em] text-[#6f838f]">
            <span className="h-px w-8 bg-[#b5f36f]/50" />
            CATALYSTS CORE <span className="text-[#3f535e]">/</span> PERSONAL WORKSPACE
          </div>
        </section>

        <section
          aria-label="Catalysts workspace preview"
          className="relative flex min-h-[360px] items-center justify-center overflow-hidden border-t border-white/10 bg-[#0a1117] p-6 sm:p-10 lg:border-l lg:border-t-0"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_52%_42%,rgba(107,148,67,0.16),transparent_45%)]"
          />
          <div aria-hidden="true" className="login-grid absolute inset-0 opacity-40" />

          <div className="relative w-full max-w-md">
            <div className="mb-4 flex items-center justify-between font-mono text-[9px] tracking-[0.18em] text-[#91a5af]">
              <span>YOUR ACADEMIC OS</span>
              <span className="flex items-center gap-2 text-[#b5f36f]">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[#b5f36f]" />
                READY WHEN YOU ARE
              </span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0d161d]/90 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[9px] tracking-[0.18em] text-[#91a5af]">
                    YOUR PERSONAL WORKSPACE
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                    Make space to focus.
                  </h2>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#b5f36f]/25 bg-[#b5f36f]/[0.08]">
                  <CatalystLogo className="size-8" />
                </div>
              </div>

              <div className="mt-7 space-y-3">
                <div className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <span className="flex size-10 items-center justify-center rounded-lg border border-[#b5f36f]/20 bg-[#b5f36f]/[0.07] text-[#c5ff82]" aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="none" className="size-5">
                      <path d="M4 3.75h8.5L16 7.25v9H4v-12.5Z" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M12 3.75v3.5h4M7 11h6M7 13.75h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#e6edf2]">Courses &amp; GPA</p>
                    <p className="mt-1 text-xs text-[#8495a2]">Keep your academic overview close.</p>
                  </div>
                  <span className="ml-auto text-[#71858f]" aria-hidden="true">↗</span>
                </div>

                <div className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <span className="flex size-10 items-center justify-center rounded-lg border border-[#83c7c4]/20 bg-[#83c7c4]/[0.07] text-[#a6d8d4]" aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="none" className="size-5">
                      <circle cx="10" cy="10" r="6.25" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M10 6.5v3.75l2.5 1.5M10 2v1.25M18 10h-1.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#e6edf2]">Study sessions</p>
                    <p className="mt-1 text-xs text-[#8495a2]">Turn your plans into steady progress.</p>
                  </div>
                  <span className="ml-auto text-[#71858f]" aria-hidden="true">↗</span>
                </div>

                <div className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <span className="flex size-10 items-center justify-center rounded-lg border border-[#d9b875]/20 bg-[#d9b875]/[0.07] text-[#e3c98e]" aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="none" className="size-5">
                      <path d="M4 15.75V10.5M8 15.75V6.75M12 15.75V9M16 15.75V4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M3 17h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#e6edf2]">Your progress</p>
                    <p className="mt-1 text-xs text-[#8495a2]">See the momentum you are building.</p>
                  </div>
                  <span className="ml-auto text-[#71858f]" aria-hidden="true">↗</span>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3 border-t border-white/[0.08] pt-5">
                <div className="flex -space-x-1">
                  <span className="size-2 rounded-full bg-[#b5f36f]" />
                  <span className="size-2 rounded-full bg-[#83c7c4]" />
                  <span className="size-2 rounded-full bg-[#d9b875]" />
                </div>
                <p className="font-mono text-[9px] tracking-[0.12em] text-[#8495a2]">
                  ONE WORKSPACE. YOUR OWN PACE.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
