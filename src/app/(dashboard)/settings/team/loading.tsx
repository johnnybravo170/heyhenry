export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 animate-pulse">
      <div>
        <div className="mb-2 h-4 w-20 rounded bg-muted" />
        <div className="h-8 w-32 rounded bg-muted" />
        <div className="mt-2 h-4 w-64 rounded bg-muted" />
      </div>
      <div className="h-40 rounded-xl border bg-card" />
      <div className="space-y-2">
        <div className="h-6 w-24 rounded bg-muted" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg border bg-card" />
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-6 w-36 rounded bg-muted" />
        {[1, 2].map((i) => (
          <div key={i} className="h-12 rounded-lg border bg-card" />
        ))}
      </div>
    </div>
  );
}
