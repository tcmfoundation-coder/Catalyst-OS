export default function MemoriesLoading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-32 animate-pulse rounded bg-slate-200" />
      <div className="h-10 w-full max-w-xl animate-pulse rounded-lg bg-slate-100" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
