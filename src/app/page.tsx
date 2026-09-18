import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Catalysts</h1>
      <p className="mt-3 max-w-md text-slate-500">
        Your personal academic operating system — courses, GPA, and study tracking in one place.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          Get started
        </Link>
      </div>
    </main>
  );
}
