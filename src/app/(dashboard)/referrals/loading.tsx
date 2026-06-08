export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl animate-pulse flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-40 rounded bg-muted" />
        <div className="h-7 w-44 rounded bg-muted" />
        <div className="mt-1 h-4 w-full max-w-xl rounded bg-muted" />
      </div>
      {/* Share hero */}
      <div className="h-64 rounded-xl border bg-card" />
      {/* Offer card */}
      <div className="h-40 rounded-xl border bg-card" />
      {/* Stats — 3-up */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl border bg-card" />
        ))}
      </div>
      {/* History */}
      <div className="h-40 rounded-xl border bg-card" />
    </div>
  );
}
