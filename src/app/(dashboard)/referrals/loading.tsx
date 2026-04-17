export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 animate-pulse">
      <div>
        <div className="h-8 w-32 rounded bg-muted" />
        <div className="mt-2 h-4 w-64 rounded bg-muted" />
      </div>
      {/* Link card skeleton */}
      <div className="h-32 rounded-lg border bg-card" />
      {/* Send invite skeleton */}
      <div className="h-48 rounded-lg border bg-card" />
      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-lg border bg-card" />
        ))}
      </div>
      {/* History skeleton */}
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg border bg-card" />
        ))}
      </div>
    </div>
  );
}
