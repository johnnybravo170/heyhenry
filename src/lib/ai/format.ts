/**
 * Formatting helpers shared by all AI tool handlers.
 */

const cadFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
});

/** Format cents as CAD currency string, e.g. "$1,234.56". */
export function formatCad(cents: number): string {
  return cadFormatter.format(cents / 100);
}

/** Format an ISO date string as a readable date, e.g. "Apr 16, 2026". */
export function formatDate(iso: string | null): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Format an ISO date string with time, e.g. "Apr 16, 2026, 2:30 PM". */
export function formatDateTime(iso: string | null): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Status labels for display. */
export const jobStatusLabels: Record<string, string> = {
  booked: 'Booked',
  in_progress: 'In Progress',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

export const quoteStatusLabels: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
};

export const invoiceStatusLabels: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  void: 'Void',
};
