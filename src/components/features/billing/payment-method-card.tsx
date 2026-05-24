'use client';

import { CreditCard, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { UpdateCardDialog } from '@/components/features/billing/update-card-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function PaymentMethodCard({
  card,
}: {
  card: { brand: string; last4: string; expMonth: number; expYear: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Payment method</CardTitle>
          <CardDescription>Used for renewals and any plan changes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {card ? (
              <div className="text-sm tabular-nums">
                <span className="font-medium capitalize">{card.brand}</span>{' '}
                <span className="text-muted-foreground tracking-wider">•••• {card.last4}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · expires {String(card.expMonth).padStart(2, '0')}/
                  {String(card.expYear).slice(-2)}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No card on file.</p>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
              <CreditCard className="size-4" aria-hidden />
              {card ? 'Update card' : 'Add card'}
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3 shrink-0" aria-hidden />
            Card details go to Stripe — HeyHenry never sees them.
          </p>
        </CardContent>
      </Card>

      <UpdateCardDialog open={open} onOpenChange={setOpen} onUpdated={() => router.refresh()} />
    </>
  );
}
