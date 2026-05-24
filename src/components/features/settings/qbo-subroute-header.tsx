import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { statusToneClass, statusToneIcon } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';

/**
 * Shared header for the three QuickBooks sub-routes (review · class-map ·
 * history). Carries a back-to-hub crumb (was a bare `← Settings`, which
 * skipped the hub) and a one-line connection read so each sub-route shows
 * which company it's operating on.
 */
export function QboSubrouteHeader({
  title,
  description,
  companyName,
  realmId,
  environment,
}: {
  title: string;
  description: string;
  companyName: string | null;
  realmId: string | null;
  environment: 'sandbox' | 'production' | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
        <Link href="/settings/quickbooks">
          <ArrowLeft className="size-4" />
          QuickBooks
        </Link>
      </Button>

      {realmId && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {companyName && <span className="font-medium text-foreground">{companyName}</span>}
          {/* realm id: mono, never tokened */}
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono">realm {realmId}</span>
          {environment === 'sandbox' && (
            <Badge variant="secondary" className={cn('gap-1 font-medium', statusToneClass.warning)}>
              <statusToneIcon.warning aria-hidden="true" className="size-3" />
              Sandbox — not your real books
            </Badge>
          )}
        </div>
      )}

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
