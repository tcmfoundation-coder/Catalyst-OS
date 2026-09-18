export default function HabitsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-24 animate-pulse rounded bg-slate-200" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
