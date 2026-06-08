/**
 * Client-visibility legibility — the #1 trust target on the Photos /
 * Documents tabs. Visibility MUST be carried by a label + glyph, never by
 * colour alone (WCAG 2.2 AA, SC 1.4.1). This test locks that in: if someone
 * later strips the text label or the icon down to a coloured dot, it fails.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VisibilityBadge } from '@/components/features/projects/visibility-badge';

describe('VisibilityBadge', () => {
  it('internal photos read "Internal" with a lock glyph (label + glyph, not colour-only)', () => {
    const { container } = render(<VisibilityBadge clientVisible={false} />);
    const badge = container.querySelector('[data-slot="visibility-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('data-visibility')).toBe('internal');
    // Text label present.
    expect(badge?.textContent).toContain('Internal');
    // Glyph (an <svg>) present alongside the label.
    expect(badge?.querySelector('svg')).not.toBeNull();
    // Meaning reachable without colour.
    expect(badge?.getAttribute('title')).toMatch(/internal/i);
  });

  it('client-visible items read "Client visible" with a globe glyph', () => {
    const { container } = render(<VisibilityBadge clientVisible={true} />);
    const badge = container.querySelector('[data-slot="visibility-badge"]');
    expect(badge?.getAttribute('data-visibility')).toBe('client');
    expect(badge?.textContent).toContain('Client visible');
    expect(badge?.querySelector('svg')).not.toBeNull();
    expect(badge?.getAttribute('title')).toMatch(/portal|client/i);
  });

  it('says "client" not "homeowner"', () => {
    const { container: a } = render(<VisibilityBadge clientVisible={true} />);
    const { container: b } = render(<VisibilityBadge clientVisible={false} />);
    expect(a.textContent?.toLowerCase()).not.toContain('homeowner');
    expect(b.textContent?.toLowerCase()).not.toContain('homeowner');
  });
});
