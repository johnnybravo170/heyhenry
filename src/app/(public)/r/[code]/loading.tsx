/**
 * Loading skeleton for the public referral landing. Paper-muted, mirrors the
 * landing layout: wordmark bar → social-proof pill → headline → bullets → CTA.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[80vh] flex-col">
      <header className="flex h-16 items-center border-b px-6 sm:px-8">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-muted" />
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-20 sm:py-24">
        <div className="flex w-full max-w-xl animate-pulse flex-col items-center">
          <div className="h-8 w-56 rounded-full bg-muted" />
          <div className="mt-5 h-10 w-full max-w-md rounded bg-muted" />
          <div className="mt-2 h-10 w-3/4 rounded bg-muted" />
          <div className="mt-5 h-4 w-full max-w-md rounded bg-muted" />
          <ul className="mt-7 flex w-full max-w-md flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="size-[18px] shrink-0 rounded-full bg-muted" />
                <div className="h-4 flex-1 rounded bg-muted" />
              </li>
            ))}
          </ul>
          <div className="mt-8 h-12 w-56 rounded-[10px] bg-muted" />
        </div>
      </main>
    </div>
  );
}
