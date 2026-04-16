/**
 * Zod validators for quote forms and server actions.
 *
 * The same schemas back both the client (React Hook Form resolver) and the
 * server (server actions). See §2 of the quoting engine spec.
 */

import { z } from 'zod';

export const quoteStatuses = ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
};

export const quoteSurfaceSchema = z.object({
  surface_type: z.string().min(1, 'Pick a surface type'),
  polygon_geojson: z.any().optional(),
  sqft: z.number().positive('Area must be greater than zero'),
  price_cents: z.number().int().nonnegative(),
  notes: z.string().optional().or(z.literal('')),
});

export const quoteCreateSchema = z.object({
  customer_id: z.string().uuid({ message: 'Pick a customer' }),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
  surfaces: z.array(quoteSurfaceSchema).min(1, 'Add at least one surface'),
});

export const quoteUpdateSchema = quoteCreateSchema.extend({
  id: z.string().uuid({ message: 'Invalid quote id.' }),
});

export type QuoteInput = z.infer<typeof quoteCreateSchema>;
export type QuoteUpdateInput = z.infer<typeof quoteUpdateSchema>;
export type QuoteSurfaceInput = z.infer<typeof quoteSurfaceSchema>;

/**
 * Collapse empty strings from the form into `null` so the DB stores a real
 * "no value" instead of the literal empty string.
 */
export function emptyToNull(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
