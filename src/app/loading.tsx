import { CatalystLogo } from "@/components/brand/catalyst-logo";

export default function Loading() {
  return (
    <main className="login-screen relative flex min-h-screen items-center justify-center overflow-hidden">
      <div aria-hidden="true" className="login-orbit login-orbit-one" />
      <div aria-hidden="true" className="login-orbit login-orbit-two" />

      <div
        role="status"
        aria-live="polite"
        className="relative z-10 flex flex-col items-center gap-5 rounded-3xl border border-white/10 bg-[#0c1319]/90 px-10 py-9 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      >
        <CatalystLogo className="size-16 animate-spin motion-reduce:animate-none" />
        <span className="font-mono text-[10px] tracking-[0.18em] text-[#a7b6bf]">
          PREPARING YOUR WORKSPACE
        </span>
      </div>
    </main>
  );
}
