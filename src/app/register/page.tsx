"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CatalystLogo } from "@/components/brand/catalyst-logo";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const passwordChecks = [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "A letter", valid: /[a-z]/i.test(password) },
    { label: "A number", valid: /\d/.test(password) },
    { label: "At least 12 characters", valid: password.length >= 12 },
    { label: "Upper/lowercase or a symbol", valid: (/[a-z]/.test(password) && /[A-Z]/.test(password)) || /[^a-zA-Z0-9]/.test(password) },
  ];
  const strengthScore = passwordChecks.filter((check) => check.valid).length;
  const strength = strengthScore >= 5 ? "Strong" : strengthScore >= 4 ? "Good" : strengthScore >= 3 ? "Fair" : "Weak";
  const strengthColor = strengthScore >= 5 ? "bg-[#b5f36f]" : strengthScore >= 4 ? "bg-[#83c7c4]" : strengthScore >= 3 ? "bg-[#f6c75c]" : "bg-[#ff756e]";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        router.push("/login");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create your account. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-screen relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-8">
      <div aria-hidden="true" className="login-orbit login-orbit-one" />
      <div aria-hidden="true" className="login-orbit login-orbit-two" />

      <div className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0c1319]/90 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl lg:min-h-[650px] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="login-brand-panel relative hidden flex-col justify-between overflow-hidden border-r border-white/10 p-12 lg:flex xl:p-16">
          <div aria-hidden="true" className="login-grid absolute inset-0 opacity-60" />
          <div aria-hidden="true" className="login-planet-wrap absolute inset-0 flex items-center justify-center">
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
              <p className="mt-0.5 font-mono text-[9px] tracking-[0.2em] text-[#91a5af]">ACADEMIC OPERATING SYSTEM</p>
            </div>
          </div>

          <div className="relative z-10 max-w-md pb-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#b5f36f]/20 bg-[#b5f36f]/[0.06] px-3 py-1.5 font-mono text-[10px] tracking-[0.16em] text-[#c5ff82]">
              <span className="size-1.5 rounded-full bg-[#b5f36f] shadow-[0_0_10px_#b5f36f]" />
              A FRESH START, BUILT AROUND YOU
            </div>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-white xl:text-5xl">
              Make room for <span className="text-[#b5f36f]">what&apos;s next.</span>
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-[#9aabb5]">
              Bring your academic plans and daily focus into one personal workspace.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-3 font-mono text-[9px] tracking-[0.15em] text-[#6f838f]">
            <span className="h-px w-8 bg-[#b5f36f]/50" />
            CATALYSTS CORE <span className="text-[#3f535e]">/</span> PERSONAL WORKSPACE
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-12 lg:px-14">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex size-10 items-center justify-center rounded-xl border border-[#b5f36f]/40 bg-[#b5f36f]/10">
                <CatalystLogo className="size-8" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-[0.22em] text-white">CATALYSTS</p>
                <p className="mt-0.5 font-mono text-[9px] tracking-[0.18em] text-[#91a5af]">ACADEMIC OPERATING SYSTEM</p>
              </div>
            </div>

            <div className="mb-7">
              <p className="mb-3 font-mono text-[10px] tracking-[0.2em] text-[#b5f36f]">NEW USER SETUP <span className="text-[#738791]">/ 02</span></p>
              <h2 className="text-3xl font-semibold tracking-[-0.035em] text-white sm:text-[34px]">Create your account</h2>
              <p className="mt-2 text-sm text-[#a7b6bf]">Start building your academic operating system.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="block text-xs font-semibold tracking-wide text-[#e7eef1]">Your name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your name"
                  className="login-input h-12 w-full rounded-xl border border-[#42535e] bg-[#111b23] px-4 text-base text-white placeholder:text-[#81929c] outline-none transition focus:border-[#b5f36f] focus:ring-2 focus:ring-[#b5f36f]/25"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="block text-xs font-semibold tracking-wide text-[#e7eef1]">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="login-input h-12 w-full rounded-xl border border-[#42535e] bg-[#111b23] px-4 text-base text-white placeholder:text-[#81929c] outline-none transition focus:border-[#b5f36f] focus:ring-2 focus:ring-[#b5f36f]/25"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="block text-xs font-semibold tracking-wide text-[#e7eef1]">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a password"
                  className="login-input h-12 w-full rounded-xl border border-[#42535e] bg-[#111b23] px-4 text-base text-white placeholder:text-[#81929c] outline-none transition focus:border-[#b5f36f] focus:ring-2 focus:ring-[#b5f36f]/25"
                />
                {password ? (
                  <div id="password-strength" className="space-y-2" aria-live="polite">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#9aabb5]">Password strength</span>
                      <span className={`text-xs font-semibold ${strengthScore >= 5 ? "text-[#c5ff82]" : strengthScore >= 4 ? "text-[#a6d8d4]" : strengthScore >= 3 ? "text-[#f6c75c]" : "text-[#ffaaa5]"}`}>
                        {strength}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Password strength"
                      aria-valuemin={0}
                      aria-valuemax={5}
                      aria-valuenow={strengthScore}
                      className="flex gap-1"
                    >
                      {passwordChecks.map((check, index) => (
                        <span
                          key={check.label}
                          className={`h-1 flex-1 rounded-full ${index < strengthScore ? strengthColor : "bg-[#27343d]"}`}
                        />
                      ))}
                    </div>
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[#9aabb5]">
                      {passwordChecks.map((check) => (
                        <li key={check.label} className={check.valid ? "text-[#c5ff82]" : ""}>
                          <span aria-hidden="true">{check.valid ? "✓" : "·"}</span>{" "}
                          {check.label}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] leading-4 text-[#9aabb5]">
                      Minimum to create an account: 8 characters, a letter, and a number.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs leading-5 text-[#9aabb5]">
                    Use at least 8 characters, including a letter and a number.
                  </p>
                )}
              </div>

              {error && <p role="alert" className="rounded-lg border border-[#ff756e]/30 bg-[#ff756e]/10 px-3 py-2.5 text-sm text-[#ffaaa5]">{error}</p>}

              <button
                type="submit"
                disabled={pending}
                className="group flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#b5f36f] px-4 text-sm font-bold text-[#10170c] shadow-[0_0_28px_rgba(181,243,111,0.16)] transition hover:bg-[#c5ff82] hover:shadow-[0_0_36px_rgba(181,243,111,0.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b5f36f] disabled:cursor-wait disabled:opacity-70"
              >
                {pending ? (
                  <>
                    <CatalystLogo className="size-5 animate-spin motion-reduce:animate-none" />
                    Creating account...
                  </>
                ) : (
                  "Create Catalysts account"
                )}
                {!pending && <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[#a7b6bf]">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-[#c5ff82] underline decoration-[#b5f36f]/35 underline-offset-4 transition hover:text-white hover:decoration-[#b5f36f]">
                Sign in
              </Link>
            </p>

            <div className="mt-8 flex items-center justify-center gap-2 font-mono text-[9px] tracking-[0.13em] text-[#70838e]">
              <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-[#b5f36f]" />
              YOUR PROGRESS, READY WHEN YOU ARE
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
