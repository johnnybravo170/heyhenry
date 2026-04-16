import { FileText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function QuoteEmptyState({ variant }: { variant: 'fresh' | 'filtered' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card p-12 text-center">
      <FileText className="size-10 text-muted-foreground/50" />
      <h2 className="mt-4 text-lg font-semibold">
        {variant === 'fresh' ? 'No quotes yet' : 'No matching quotes'}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {variant === 'fresh'
          ? 'Create your first quote. Draw polygons on satellite maps for accurate measurements.'
          : 'Try adjusting the filters above.'}
      </p>
      {variant === 'fresh' && (
        <Button asChild className="mt-4">
          <Link href="/quotes/new">Create your first quote</Link>
        </Button>
      )}
    </div>
  );
}
