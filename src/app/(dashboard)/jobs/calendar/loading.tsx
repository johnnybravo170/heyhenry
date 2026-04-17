export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 animate-pulse">
      <div className="flex items-end justify-between">
        <div>
          <div className="h-8 w-24 rounded bg-muted" />
          <div className="mt-2 h-4 w-48 rounded bg-muted" />
        </div>
        <div className="h-9 w-28 rounded-md bg-muted" />
      </div>
      <div className="h-8 w-64 rounded bg-muted" />
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: 35 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton grid
          <div key={i} className="h-24 rounded border bg-card" />
        ))}
      </div>
    </div>
  );
}
