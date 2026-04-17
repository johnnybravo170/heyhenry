import { getKeyMetrics } from '@/lib/db/queries/dashboard';
import { listInvoices } from '@/lib/db/queries/invoices';
import { formatCad, formatDate, invoiceStatusLabels } from '../format';
import type { AiTool } from '../types';

/** Timezone injected from tenant context for revenue queries. */
let _timezone = 'America/Vancouver';
export function setInvoiceTimezone(tz: string) {
  _timezone = tz;
}

export const invoiceTools: AiTool[] = [
  {
    definition: {
      name: 'list_invoices',
      description: 'List invoices. Filter by status (draft/sent/paid/void).',
      input_schema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['draft', 'sent', 'paid', 'void'],
            description: 'Filter by invoice status',
          },
          limit: {
            type: 'number',
            description: 'Max results (default 20, max 100)',
          },
        },
      },
    },
    handler: async (input) => {
      try {
        const rows = await listInvoices({
          status: input.status as 'draft' | 'sent' | 'paid' | 'void' | undefined,
          limit: Math.min((input.limit as number) || 20, 100),
        });

        if (rows.length === 0) {
          return 'No invoices found matching your criteria.';
        }

        let output = `Found ${rows.length} invoice(s):\n\n`;
        for (let i = 0; i < rows.length; i++) {
          const inv = rows[i];
          const total = inv.amount_cents + inv.tax_cents;
          output += `${i + 1}. ${inv.customer?.name ?? 'No customer'} - ${formatCad(total)}\n`;
          output += `   Status: ${invoiceStatusLabels[inv.status] ?? inv.status}`;
          output += ` | Created: ${formatDate(inv.created_at)}`;
          if (inv.sent_at) output += ` | Sent: ${formatDate(inv.sent_at)}`;
          if (inv.paid_at) output += ` | Paid: ${formatDate(inv.paid_at)}`;
          output += `\n   ID: ${inv.id}\n\n`;
        }

        return output;
      } catch (e) {
        return `Failed to list invoices: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
  {
    definition: {
      name: 'get_revenue_summary',
      description:
        'Revenue summary: total revenue (paid invoices), outstanding amount, open jobs, and pending quotes for the current month.',
      input_schema: {
        type: 'object',
        properties: {},
      },
    },
    handler: async () => {
      try {
        const metrics = await getKeyMetrics(_timezone);

        let output = `Revenue Summary (This Month)\n${'='.repeat(40)}\n\n`;
        output += `Total Revenue: ${formatCad(metrics.revenueThisMonthCents)}\n`;
        output += `Outstanding (Unpaid): ${formatCad(metrics.outstandingCents)}\n`;
        output += `Open Jobs: ${metrics.openJobsCount}\n`;
        output += `Pending Quotes: ${metrics.pendingQuotesCount}\n`;

        return output;
      } catch (e) {
        return `Failed to get revenue summary: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
];
