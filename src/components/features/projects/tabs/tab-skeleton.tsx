/**
 * Generic loading skeleton shown inside each tab's Suspense boundary
 * while its data streams. A handful of pulsing cards is enough — we
 * don't try to mimic the eventual layout precisely, because different
 * tabs differ in shape.
 */

export function TabSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-10 rounded-md bg-muted/60" />
      <div className="h-32 rounded-md bg-muted/60" />
      <div className="h-32 rounded-md bg-muted/60" />
    </div>
  );
}
