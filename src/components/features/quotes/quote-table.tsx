import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { QuoteWithCustomer } from '@/lib/db/queries/quotes';
import { formatCurrency } from '@/lib/pricing/calculator';
import type { QuoteStatus } from '@/lib/validators/quote';
import { QuoteStatusBadge } from './quote-status-badge';

const dateFormatter = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium' });

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014';
  return dateFormatter.format(new Date(iso));
}

export function QuoteTable({ quotes }: { quotes: QuoteWithCustomer[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((q) => (
            <TableRow key={q.id} className="cursor-pointer transition-colors hover:bg-muted/50">
              <TableCell className="font-medium">
                <Link href={`/quotes/${q.id}`} className="text-foreground hover:underline">
                  {q.customer?.name ?? 'Unknown customer'}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(q.total_cents)}
              </TableCell>
              <TableCell>
                <QuoteStatusBadge status={q.status as QuoteStatus} />
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDate(q.sent_at)}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(q.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
