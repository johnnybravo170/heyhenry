import { describe, expect, it } from 'vitest';
import { buildClassifierPrompt, parseClassifierResponse } from '@/lib/photos/ai-classifier';

describe('buildClassifierPrompt', () => {
  it('includes all nine tag values', () => {
    const { system } = buildClassifierPrompt({}, {});
    for (const tag of [
      'before',
      'after',
      'progress',
      'damage',
      'materials',
      'equipment',
      'serial',
      'concern',
      'other',
    ]) {
      expect(system).toContain(tag);
    }
  });

  it('includes job context when provided', () => {
    const { user } = buildClassifierPrompt(
      {
        vertical: 'pressure_washing',
        jobStatus: 'in_progress',
        surfaces: ['driveway', 'siding'],
        customerCity: 'Abbotsford',
      },
      {},
    );
    expect(user).toContain('pressure_washing');
    expect(user).toContain('in_progress');
    expect(user).toContain('driveway');
    expect(user).toContain('Abbotsford');
  });

  it('uses the concise caption style by default', () => {
    const { system } = buildClassifierPrompt({}, {});
    expect(system).toMatch(/80 characters/);
  });

  it('switches to descriptive caption style when requested', () => {
    const { system } = buildClassifierPrompt({}, { captionStyle: 'descriptive' });
    expect(system).toMatch(/140 characters/);
  });
});

describe('parseClassifierResponse', () => {
  const sample = {
    tag: 'before',
    tag_confidence: 0.92,
    caption: 'Dirty concrete driveway, oil staining near garage door.',
    caption_confidence: 0.88,
    quality: { blurry: false, too_dark: false, low_contrast: false },
  };

  it('parses a clean JSON response', () => {
    const result = parseClassifierResponse(JSON.stringify(sample));
    expect(result.tag).toBe('before');
    expect(result.tagConfidence).toBeCloseTo(0.92);
    expect(result.caption).toContain('driveway');
    expect(result.captionConfidence).toBeCloseTo(0.88);
  });

  it('strips markdown fences', () => {
    const wrapped = `\`\`\`json\n${JSON.stringify(sample)}\n\`\`\``;
    const result = parseClassifierResponse(wrapped);
    expect(result.tag).toBe('before');
  });

  it('extracts JSON from surrounding prose', () => {
    const noisy = `Here is the classification:\n${JSON.stringify(sample)}\n\nHope this helps!`;
    const result = parseClassifierResponse(noisy);
    expect(result.tag).toBe('before');
  });

  it('clamps confidence to [0, 1]', () => {
    const result = parseClassifierResponse(
      JSON.stringify({ ...sample, tag_confidence: 1.5, caption_confidence: -0.3 }),
    );
    expect(result.tagConfidence).toBe(1);
    expect(result.captionConfidence).toBe(0);
  });

  it('falls back to "other" for unknown tags', () => {
    const result = parseClassifierResponse(JSON.stringify({ ...sample, tag: 'dragon' }));
    expect(result.tag).toBe('other');
  });

  it('normalizes quality flags to booleans', () => {
    const result = parseClassifierResponse(
      JSON.stringify({
        ...sample,
        quality: { blurry: 'yes', too_dark: 1, low_contrast: null, notes: 'glare' },
      }),
    );
    expect(result.qualityFlags.blurry).toBe(false); // only strict `true` applies
    expect(result.qualityFlags.too_dark).toBe(false);
    expect(result.qualityFlags.low_contrast).toBe(false);
    expect(result.qualityFlags.notes).toBe('glare');
  });

  it('throws on non-JSON input', () => {
    expect(() => parseClassifierResponse('nope not json')).toThrow();
  });
});
