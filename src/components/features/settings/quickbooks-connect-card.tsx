'use client';

import { ExternalLink, Loader2, Unplug } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/date/format';
import { statusToneClass, statusToneIcon } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import { connectQboAction, disconnectQboAction } from '@/server/actions/qbo';

type Props = {
  realmId: string | null;
  companyName: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  environment: 'sandbox' | 'production' | null;
  lastImportAt: string | null;
  timezone: string;
  reviewCount: number;
  lastRunFailed: boolean;
};

/** Intuit "Connect to QuickBooks" brand button — the one licensed
 *  non-rust accent on this surface (Intuit connect-button guidelines:
 *  #2CA01C fill, white wordmark, QB glyph). */
function IntuitConnectButton({
  onClick,
  disabled,
  pending,
  label = 'Connect to QuickBooks',
}: {
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-11 items-center gap-2.5 rounded-md border border-[#2CA01C] bg-[#2CA01C] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#1F8418] disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <span className="grid size-5 place-items-center rounded-full bg-white text-xs font-extrabold text-[#2CA01C]">
          qb
        </span>
      )}
      {label}
    </button>
  );
}

export function QuickBooksConnectCard({
  realmId,
  companyName,
  connectedAt,
  disconnectedAt,
  environment,
  lastImportAt,
  timezone,
  reviewCount,
  lastRunFailed,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const qboParam = searchParams?.get('qbo');
  const isConnected = Boolean(realmId && connectedAt);
  // A hard error/invalid OAuth return that should reflect on the
  // disconnected header (not just a vanishing toast).
  const oauthFailed = qboParam === 'invalid' || qboParam === 'error';

  // Handle return from Intuit OAuth.
  useEffect(() => {
    if (!qboParam) return;
    if (qboParam === 'connected') {
      toast.success('QuickBooks connected.');
    } else if (qboParam === 'denied') {
      toast.info('Connection cancelled.');
    } else if (qboParam === 'invalid') {
      toast.error('Connection link expired. Try again.');
    } else if (qboParam === 'error') {
      toast.error('Could not connect to QuickBooks. Try again or contact support.');
    }
    router.replace('/settings/quickbooks');
  }, [qboParam, router]);

  function handleConnect() {
    startTransition(async () => {
      const result = await connectQboAction();
      if (result.ok && result.url) {
        window.location.href = result.url;
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectQboAction();
      if (result.ok) {
        toast.success('QuickBooks disconnected.');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  // ── Disconnected: Intuit CTA + value prop + the import-only boundary ──
  if (!isConnected) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold">Connect QuickBooks Online</h3>
            <p className="max-w-xl text-sm text-muted-foreground">
              QuickBooks is your books — HeyHenry reads from it. Connect once and we&rsquo;ll pull
              your customers, invoices, payments, and costs so your historical work shows up here
              from day one.{' '}
              <strong className="font-medium text-foreground">
                Nothing here writes back to your QuickBooks file
              </strong>{' '}
              — pushing invoices &amp; costs out is coming.
            </p>
          </div>

          {oauthFailed && (
            <p
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
                statusToneClass.danger,
              )}
            >
              <statusToneIcon.danger aria-hidden="true" className="size-3.5" />
              Last attempt didn&rsquo;t complete — try again.
            </p>
          )}

          <IntuitConnectButton onClick={handleConnect} disabled={isPending} pending={isPending} />

          {disconnectedAt && (
            <p className="text-sm text-muted-foreground">
              Previously connected{companyName ? ` to ${companyName}` : ''} ·{' '}
              {formatDate(disconnectedAt, { timezone })}. Reconnecting to the same file picks up
              cleanly.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Connected: the connection-health cockpit ──
  const showNeedsYou = reviewCount > 0 || lastRunFailed;
  const needsYouDanger = lastRunFailed;
  const NeedsIcon = needsYouDanger ? statusToneIcon.danger : statusToneIcon.warning;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold">{companyName ?? 'QuickBooks Online'}</span>
              <Badge
                variant="secondary"
                className={cn('gap-1 font-medium', statusToneClass.success)}
              >
                <statusToneIcon.success aria-hidden="true" className="size-3" />
                Connected
              </Badge>
              {environment === 'sandbox' && (
                <Badge
                  variant="secondary"
                  className={cn('gap-1 font-medium', statusToneClass.warning)}
                >
                  <statusToneIcon.warning aria-hidden="true" className="size-3" />
                  Sandbox — not your real books
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {/* realm id: mono, never a status-token color — security + noise */}
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
                realm {realmId}
              </span>
              <span>
                Last import: {lastImportAt ? formatDate(lastImportAt, { timezone }) : 'none yet'}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a
                href={
                  environment === 'sandbox'
                    ? 'https://sandbox.qbo.intuit.com'
                    : 'https://qbo.intuit.com'
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-3.5" />
                Open in QuickBooks
              </a>
            </Button>
            {/* Disconnect: owner-only by canon (admins operate, don't sever).
                Role-gating is enforced server-side in disconnectQboAction —
                unchanged here; flagged for the Ops role-matrix confirm. */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Unplug className="size-3.5" />
                  Disconnect
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect QuickBooks?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Imported records stay in HeyHenry. Importing stops until you reconnect. Your
                    QuickBooks file is untouched.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDisconnect}
                    disabled={isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isPending && <Loader2 className="size-3.5 animate-spin" />}
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* "Needs you" — one line, not stacked banners */}
        {showNeedsYou && (
          <a
            href={lastRunFailed ? '/settings/qbo-history' : '/settings/qbo-review'}
            className={cn(
              'flex items-center gap-2 border-t px-6 py-3 text-sm font-medium',
              needsYouDanger ? statusToneClass.danger : statusToneClass.warning,
            )}
          >
            <NeedsIcon aria-hidden="true" className="size-4 shrink-0" />
            <span>
              {[
                reviewCount > 0
                  ? `${reviewCount} customer${reviewCount === 1 ? '' : 's'} need review`
                  : null,
                lastRunFailed ? 'last import failed' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <span className="ml-auto underline underline-offset-2">
              {lastRunFailed ? 'View history →' : 'Resolve now →'}
            </span>
          </a>
        )}
      </CardContent>
    </Card>
  );
}
