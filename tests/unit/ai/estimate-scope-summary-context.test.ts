/**
 * Client-boundary coverage for the ✦ Henry estimate scope-summary prompt.
 *
 * Lump-sum / sections mode exists to HIDE the cost breakdown — the client
 * sees one total + this paragraph. So the prompt context MUST carry only
 * scope ("the what") and NEVER prices, line totals, markup, margin, the
 * management fee, supplier names, or SKUs. The input type is already
 * money-free by construction; this locks the builder so a future field
 * addition can't silently leak pricing into the model.
 */

import { describe, expect, it } from 'vitest';
import { buildScopeSummaryContext, type ScopeSummaryInput } from '@/lib/ai/estimate-scope-summary';

const input: ScopeSummaryInput = {
  projectName: 'Hillcrest Basement Finish',
  description: 'Finish the basement into a suite with a wet bar.',
  lines: [
    {
      label: 'Frame interior walls',
      notes: 'Including the mechanical room partition',
      categoryName: 'Framing',
      section: 'Structure',
    },
    {
      label: 'Wet bar cabinetry',
      notes: 'Shaker, white oak',
      categoryName: 'Millwork',
      section: 'Finishes',
    },
    { label: 'Pot lights throughout', notes: null, categoryName: 'Electrical', section: 'Systems' },
  ],
};

describe('buildScopeSummaryContext — client boundary', () => {
  const ctx = buildScopeSummaryContext(input);

  it('includes client-safe scope material', () => {
    expect(ctx).toContain('Hillcrest Basement Finish');
    expect(ctx).toContain('Frame interior walls');
    expect(ctx).toContain('Wet bar cabinetry');
    expect(ctx).toContain('Framing');
    expect(ctx).toContain('Structure');
  });

  it('never carries pricing / markup / margin / management-fee language', () => {
    const lower = ctx.toLowerCase();
    expect(ctx).not.toMatch(/\$/);
    expect(ctx).not.toMatch(/\bcents\b/i);
    expect(lower).not.toContain('price');
    expect(lower).not.toContain('total');
    expect(lower).not.toContain('markup');
    expect(lower).not.toContain('margin');
    expect(lower).not.toContain('management fee');
    expect(lower).not.toContain('supplier');
    expect(lower).not.toContain('sku');
  });
});
