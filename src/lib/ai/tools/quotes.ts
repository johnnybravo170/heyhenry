import { getQuote, listQuotes } from '@/lib/db/queries/quotes';
import { formatCad, formatDate, quoteStatusLabels } from '../format';
import type { AiTool } from '../types';

export const quoteTools: AiTool[] = [
  {
    definition: {
      name: 'list_quotes',
      description:
        'List quotes. Filter by status (draft/sent/accepted/rejected/expired) or customer.',
      input_schema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
            description: 'Filter by status',
          },
          customer_id: {
            type: 'string',
            description: 'Filter by customer UUID',
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
        const rows = await listQuotes({
          status: input.status as
            | 'draft'
            | 'sent'
            | 'accepted'
            | 'rejected'
            | 'expired'
            | undefined,
          customer_id: input.customer_id as string | undefined,
          limit: Math.min((input.limit as number) || 20, 100),
        });

        if (rows.length === 0) {
          return 'No quotes found matching your criteria.';
        }

        let output = `Found ${rows.length} quote(s):\n\n`;
        for (let i = 0; i < rows.length; i++) {
          const q = rows[i];
          output += `${i + 1}. ${q.customer?.name ?? 'No customer'} - ${formatCad(q.total_cents)}\n`;
          output += `   Status: ${quoteStatusLabels[q.status] ?? q.status}`;
          output += ` | Created: ${formatDate(q.created_at)}`;
          if (q.sent_at) output += ` | Sent: ${formatDate(q.sent_at)}`;
          output += `\n   ID: ${q.id}\n\n`;
        }

        return output;
      } catch (e) {
        return `Failed to list quotes: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
  {
    definition: {
      name: 'get_quote',
      description:
        'Get full quote details including surfaces breakdown, pricing, and customer info.',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Quote UUID' },
        },
        required: ['id'],
      },
    },
    handler: async (input) => {
      try {
        const quote = await getQuote(input.id as string);
        if (!quote) {
          return 'Quote not found.';
        }

        let output = `Quote Details\n${'='.repeat(40)}\n\n`;
        output += `Customer: ${quote.customer?.name ?? 'N/A'}\n`;
        if (quote.customer?.phone) output += `Phone: ${quote.customer.phone}\n`;
        if (quote.customer?.email) output += `Email: ${quote.customer.email}\n`;
        output += `Status: ${quoteStatusLabels[quote.status] ?? quote.status}\n`;
        output += `Created: ${formatDate(quote.created_at)}\n`;
        if (quote.sent_at) output += `Sent: ${formatDate(quote.sent_at)}\n`;
        if (quote.accepted_at) output += `Accepted: ${formatDate(quote.accepted_at)}\n`;
        if (quote.notes) output += `Notes: ${quote.notes}\n`;

        output += `\nSurfaces\n${'-'.repeat(30)}\n`;
        if (quote.surfaces.length === 0) {
          output += '  No surfaces on this quote.\n';
        } else {
          for (const s of quote.surfaces) {
            output += `  ${s.surface_type}`;
            if (s.sqft) output += ` (${s.sqft} sq ft)`;
            output += ` - ${formatCad(s.price_cents)}`;
            if (s.notes) output += ` -- ${s.notes}`;
            output += '\n';
          }
        }

        output += `\nPricing\n${'-'.repeat(30)}\n`;
        output += `  Subtotal: ${formatCad(quote.subtotal_cents)}\n`;
        output += `  Tax:      ${formatCad(quote.tax_cents)}\n`;
        output += `  Total:    ${formatCad(quote.total_cents)}\n`;

        return output;
      } catch (e) {
        return `Failed to get quote: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
];
