'use client';

/**
 * Calm degrade for a failed review-queue load. The server page catches the
 * `listBankReviewQueue` throw and renders this instead of bubbling to the
 * route 500 boundary. Retry re-fetches the server component via
 * `router.refresh()` (a same-URL <Link> wouldn't re-run the query).
 */

import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';

export function RetryCard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <AlertTriangle className="size-6 text-muted-foreground" aria-hidden />
      <h2 className="text-base font-semibold">Couldn't load your matches</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Something went wrong reading the review queue. Your data is safe — nothing was changed.
      </p>
      <Button size="sm" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
        {pending ? 'Retrying…' : 'Retry'}
      </Button>
    </div>
  );
}
