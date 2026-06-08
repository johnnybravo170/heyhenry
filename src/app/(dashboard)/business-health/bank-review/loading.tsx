import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Route-level skeleton for the bank review queue. Mirrors the queue's row
 * grid (checkbox · date · description+match · amount · reject) so the
 * fallback doesn't jump when real rows land.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </header>
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-8 w-40" />
          </div>
          <Skeleton className="h-11 w-52" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-11 w-full" />
          <ul className="flex flex-col divide-y">
            {[0, 1, 2, 3, 4].map((i) => (
              <li
                key={i}
                className="grid grid-cols-[auto_110px_1fr_auto_auto] items-center gap-3 py-3"
              >
                <Skeleton className="size-4" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="size-7" />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
