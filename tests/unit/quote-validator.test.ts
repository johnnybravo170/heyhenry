/**
 * Unit tests for the quote Zod validators.
 *
 * Covers required fields, surface array constraints, UUID validation,
 * and the empty-string contract for optional fields.
 */

import { describe, expect, it } from 'vitest';
import { emptyToNull, quoteCreateSchema, quoteUpdateSchema } from '@/lib/validators/quote';

const VALID_UUID = '11111111-2222-4333-8444-555555555555';
const OTHER_UUID = '99999999-8888-4777-8666-555555555555';

const VALID_SURFACE = {
  surface_type: 'driveway',
  sqft: 500,
  price_cents: 7500,
};

describe('quoteCreateSchema', () => {
  it('accepts a valid quote with surfaces', () => {
    const parsed = quoteCreateSchema.safeParse({
      customer_id: VALID_UUID,
      notes: 'Gate code 4821',
      surfaces: [VALID_SURFACE],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.customer_id).toBe(VALID_UUID);
      expect(parsed.data.surfaces).toHaveLength(1);
    }
  });

  it('accepts multiple surfaces', () => {
    const parsed = quoteCreateSchema.safeParse({
      customer_id: VALID_UUID,
      surfaces: [VALID_SURFACE, { surface_type: 'siding', sqft: 300, price_cents: 7500 }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.surfaces).toHaveLength(2);
    }
  });

  it('rejects missing customer_id', () => {
    const parsed = quoteCreateSchema.safeParse({
      customer_id: '',
      surfaces: [VALID_SURFACE],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid customer_id', () => {
    const parsed = quoteCreateSchema.safeParse({
      customer_id: 'not-a-uuid',
      surfaces: [VALID_SURFACE],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects empty surfaces array', () => {
    const parsed = quoteCreateSchema.safeParse({
      customer_id: VALID_UUID,
      surfaces: [],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      expect(flat.fieldErrors.surfaces?.[0]).toMatch(/at least one surface/i);
    }
  });

  it('rejects negative sqft', () => {
    const parsed = quoteCreateSchema.safeParse({
      customer_id: VALID_UUID,
      surfaces: [{ ...VALID_SURFACE, sqft: -10 }],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects zero sqft', () => {
    const parsed = quoteCreateSchema.safeParse({
      customer_id: VALID_UUID,
      surfaces: [{ ...VALID_SURFACE, sqft: 0 }],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects missing surface_type', () => {
    const parsed = quoteCreateSchema.safeParse({
      customer_id: VALID_UUID,
      surfaces: [{ surface_type: '', sqft: 100, price_cents: 1000 }],
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts empty notes', () => {
    const parsed = quoteCreateSchema.safeParse({
      customer_id: VALID_UUID,
      notes: '',
      surfaces: [VALID_SURFACE],
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts omitted notes', () => {
    const parsed = quoteCreateSchema.safeParse({
      customer_id: VALID_UUID,
      surfaces: [VALID_SURFACE],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects notes over 2000 characters', () => {
    const parsed = quoteCreateSchema.safeParse({
      customer_id: VALID_UUID,
      notes: 'x'.repeat(2001),
      surfaces: [VALID_SURFACE],
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts surface with optional polygon_geojson', () => {
    const parsed = quoteCreateSchema.safeParse({
      customer_id: VALID_UUID,
      surfaces: [
        {
          ...VALID_SURFACE,
          polygon_geojson: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 1],
                [0, 1],
                [0, 0],
              ],
            ],
          },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts negative price_cents as zero floor', () => {
    // nonnegative means >= 0, so negative should fail
    const parsed = quoteCreateSchema.safeParse({
      customer_id: VALID_UUID,
      surfaces: [{ ...VALID_SURFACE, price_cents: -100 }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('quoteUpdateSchema', () => {
  it('requires a UUID id', () => {
    const parsed = quoteUpdateSchema.safeParse({
      id: 'not-a-uuid',
      customer_id: VALID_UUID,
      surfaces: [VALID_SURFACE],
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts a valid update payload', () => {
    const parsed = quoteUpdateSchema.safeParse({
      id: VALID_UUID,
      customer_id: OTHER_UUID,
      surfaces: [VALID_SURFACE],
    });
    expect(parsed.success).toBe(true);
  });
});

describe('emptyToNull', () => {
  it('converts empty and whitespace-only strings to null', () => {
    expect(emptyToNull('')).toBeNull();
    expect(emptyToNull('   ')).toBeNull();
  });

  it('trims whitespace but returns non-empty values', () => {
    expect(emptyToNull('  hello  ')).toBe('hello');
  });

  it('passes through null and undefined', () => {
    expect(emptyToNull(null)).toBeNull();
    expect(emptyToNull(undefined)).toBeNull();
  });
});
