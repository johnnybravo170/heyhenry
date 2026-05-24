/**
 * Client-boundary coverage for the ✦ Henry closeout-summary prompt.
 *
 * The Home Record artifact is a no-login public page that a client may
 * forward to a competitor. The summary is generated from snapshot data, so
 * the prompt context MUST NOT carry margin / markup / supplier cost / SKU /
 * allowance / actual-cost — only client-safe narrative material. This locks
 * that boundary so a future snapshot-field addition can't silently leak.
 */

import { describe, expect, it } from 'vitest';
import { buildCloseoutSummaryContext } from '@/lib/ai/closeout-summary';
import type { HomeRecordSnapshotV1 } from '@/lib/db/queries/home-records';

const snapshot: HomeRecordSnapshotV1 = {
  version: 1,
  generated_at: '2026-05-15T00:00:00Z',
  timezone: 'America/Vancouver',
  contractor: { name: 'Northbeam Build Co.', logo_storage_path: null },
  customer: { name: 'Helen Chao', address: '2918 Hillcrest', email: null, phone: null },
  project: {
    name: 'Hillcrest Kitchen Remodel',
    description: 'Full galley-to-open kitchen conversion.',
    start_date: '2026-01-18',
    target_end_date: '2026-05-15',
  },
  phases: [
    { id: 'p1', name: 'Demolition', status: 'complete', started_at: null, completed_at: null },
  ],
  selections: [
    {
      room: 'Kitchen',
      category: 'countertop',
      brand: 'Caesarstone',
      name: 'Pure White',
      code: 'CS-1141',
      finish: '3cm',
      supplier: 'SUPER-SECRET-SUPPLIER-INC',
      sku: 'SKU-LEAK-12345',
      warranty_url: null,
      notes: null,
      allowance_cents: 900000,
      actual_cost_cents: 1150000,
    },
  ],
  photos: [],
  documents: [],
  decisions: [],
  change_orders: [
    {
      title: 'Add island pendant run',
      description: 'New circuit + boxes',
      cost_impact_cents: 125000,
      timeline_impact_days: 0,
      approved_at: null,
      approved_by_name: 'Helen Chao',
    },
  ],
};

describe('buildCloseoutSummaryContext — client boundary', () => {
  const ctx = buildCloseoutSummaryContext(snapshot);

  it('includes client-safe narrative material', () => {
    expect(ctx).toContain('Hillcrest Kitchen Remodel');
    expect(ctx).toContain('Caesarstone');
    expect(ctx).toContain('Demolition');
    // Approved CO cost impact (CAD) is the one legitimate money figure.
    expect(ctx).toMatch(/\$1,250/);
  });

  it('never leaks supplier / SKU into the prompt', () => {
    expect(ctx).not.toContain('SUPER-SECRET-SUPPLIER-INC');
    expect(ctx).not.toContain('SKU-LEAK-12345');
    expect(ctx.toLowerCase()).not.toContain('supplier');
    expect(ctx.toLowerCase()).not.toContain('sku');
  });

  it('never leaks allowance / actual-cost / margin into the prompt', () => {
    // The over-allowance figures ($9,000 allowance, $11,500 actual) must
    // not reach the model — they're an internal margin tell.
    expect(ctx).not.toMatch(/9,000/);
    expect(ctx).not.toMatch(/11,500/);
    expect(ctx).not.toMatch(/900000/);
    expect(ctx).not.toMatch(/1150000/);
    expect(ctx.toLowerCase()).not.toContain('margin');
    expect(ctx.toLowerCase()).not.toContain('markup');
    expect(ctx.toLowerCase()).not.toContain('allowance');
  });
});
