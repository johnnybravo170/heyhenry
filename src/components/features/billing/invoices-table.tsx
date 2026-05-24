'use client';

import { Download, ExternalLink, Info } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import { type StatusTone, statusToneClass, statusToneIcon } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import { type InvoiceRow, listInvoicesAction } from '@/server/actions/billing-management';

const PAGE_SIZE = 12;

/** HeyHenry receipt status → status-tokens tone (paid is the common case). */
function receiptTone(status: string): StatusTone {
  switch (status) {
    case 'paid':
      return 'success';
    case 'open':
    case 'draft':
      return 'info';
    case 'uncollectible':
    case 'void':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function InvoicesTable() {
  const tz = useTenantTimezone();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const r = await listInvoicesAction({ limit: PAGE_SIZE });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setRows(r.invoices);
      setHasMore(r.hasMore);
      setCursor(r.nextCursor);
      setLoaded(true);
    });
  }, []);

  function loadMore() {
    if (!cursor) return;
    startTransition(async () => {
      const r = await listInvoicesAction({ limit: PAGE_SIZE, cursor });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setRows((prev) => [...prev, ...r.invoices]);
      setHasMore(r.hasMore);
      setCursor(r.nextCursor);
    });
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Invoice history</CardTitle>
        <CardDescription>
          Receipts for every charge, including GST. CRA-acceptable for your input tax credit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!loaded && pending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{formatDate(inv.createdIso, tz)}</TableCell>
                    <TableCell className="text-right">
                      {formatCents(inv.amountPaidCents || inv.amountDueCents, inv.currency)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {inv.taxCents > 0 ? formatCents(inv.taxCents, inv.currency) : '—'}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const tone = receiptTone(inv.status);
                        const Icon = statusToneIcon[tone];
                        return (
                          <Badge
                            variant="secondary"
                            className={cn('gap-1 font-medium capitalize', statusToneClass[tone])}
                          >
                            <Icon aria-hidden className="size-3" />
                            {inv.status.replace('_', ' ')}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        {inv.hostedUrl ? (
                          <Button asChild variant="ghost" size="icon" className="size-11 sm:size-9">
                            <a
                              href={inv.hostedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="View invoice on Stripe"
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          </Button>
                        ) : null}
                        {inv.pdfUrl ? (
                          <Button asChild variant="ghost" size="icon" className="size-11 sm:size-9">
                            <a
                              href={inv.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Download PDF receipt"
                            >
                              <Download className="size-4" />
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {hasMore ? (
              <div className="mt-3 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  disabled={pending}
                >
                  {pending ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            ) : null}
          </>
        )}

        {/* Disambiguate the three money surfaces. This screen is the GC's OWN
            HeyHenry subscription — NOT the receipts they send clients, and NOT
            the Stripe Connect payouts they collect from clients. One cross-link
            line so the operator never updates the wrong card. */}
        <p className="mt-4 flex items-start gap-2 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
          <span>
            Paying your subcontractors or receiving client payments? That's{' '}
            <Link
              href="/settings/stripe"
              className="font-semibold text-foreground underline underline-offset-2"
            >
              Stripe Connect →
            </Link>{' '}
            a different money surface from your HeyHenry subscription.
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

function formatCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function formatDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}
