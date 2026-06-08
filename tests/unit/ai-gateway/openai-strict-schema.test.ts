import { describe, expect, it } from 'vitest';
import { toOpenAiStrictSchema } from '@/lib/ai-gateway/providers/openai-strict-schema';

describe('toOpenAiStrictSchema', () => {
  it('adds additionalProperties:false and requires every key on an object', () => {
    const out = toOpenAiStrictSchema({
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'integer' } },
      required: ['a', 'b'],
    }) as Record<string, unknown>;

    expect(out.additionalProperties).toBe(false);
    expect(out.required).toEqual(['a', 'b']);
  });

  it('makes a formerly-optional field nullable and required', () => {
    const out = toOpenAiStrictSchema({
      type: 'object',
      properties: { a: { type: 'string' }, note: { type: 'string' } },
      required: ['a'],
    }) as Record<string, unknown>;

    expect(out.required).toEqual(['a', 'note']);
    const props = out.properties as Record<string, { type: unknown }>;
    expect(props.a.type).toBe('string'); // required → untouched
    expect(props.note.type).toEqual(['string', 'null']); // optional → nullable
  });

  it('recurses into nested objects and array items', () => {
    const out = toOpenAiStrictSchema({
      type: 'object',
      properties: {
        customer: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { label: { type: 'string' }, qty: { type: 'integer' } },
            required: ['label'],
          },
        },
      },
      required: ['customer', 'items'],
    }) as Record<string, unknown>;

    const props = out.properties as Record<string, Record<string, unknown>>;
    expect(props.customer.additionalProperties).toBe(false);
    const items = props.items.items as Record<string, unknown>;
    expect(items.additionalProperties).toBe(false);
    expect(items.required).toEqual(['label', 'qty']);
    // qty was optional inside items → nullable
    const itemProps = items.properties as Record<string, { type: unknown }>;
    expect(itemProps.qty.type).toEqual(['integer', 'null']);
  });

  it('extends an existing type array with null rather than duplicating', () => {
    const out = toOpenAiStrictSchema({
      type: 'object',
      properties: { x: { type: ['string', 'null'] } },
      required: [],
    }) as Record<string, unknown>;
    const props = out.properties as Record<string, { type: unknown }>;
    expect(props.x.type).toEqual(['string', 'null']);
  });

  it('is idempotent on an already-strict schema', () => {
    const strict = {
      type: 'object',
      additionalProperties: false,
      properties: { a: { type: ['string', 'null'] } },
      required: ['a'],
    };
    expect(toOpenAiStrictSchema(strict)).toEqual(strict);
  });

  it('does not mutate the input', () => {
    const input = {
      type: 'object',
      properties: { a: { type: 'string' } },
      required: ['a'],
    };
    const snapshot = JSON.parse(JSON.stringify(input));
    toOpenAiStrictSchema(input);
    expect(input).toEqual(snapshot);
  });

  it('passes primitives and non-schema values through untouched', () => {
    expect(toOpenAiStrictSchema('x')).toBe('x');
    expect(toOpenAiStrictSchema(42)).toBe(42);
    expect(toOpenAiStrictSchema(null)).toBe(null);
  });
});
