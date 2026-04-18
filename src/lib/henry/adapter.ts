/**
 * Adapter: convert existing Anthropic-format tool definitions to Gemini
 * FunctionDeclaration format.
 *
 * The handlers themselves are format-agnostic — they take (name, args) and
 * return a string. Only the declarations differ between providers.
 *
 * Anthropic uses JSON Schema with lowercase type names (`"string"`, `"object"`).
 * Gemini expects uppercase type names (`"STRING"`, `"OBJECT"`). Everything else
 * (properties, required, descriptions) transfers unchanged.
 */

import type { AiTool } from '@/lib/ai/types';

export type GeminiFunctionDeclaration = {
  name: string;
  description: string;
  parameters?: {
    type: 'OBJECT';
    properties?: Record<string, unknown>;
    required?: string[];
  };
};

function uppercaseTypes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(uppercaseTypes);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = k === 'type' && typeof v === 'string' ? v.toUpperCase() : uppercaseTypes(v);
    }
    return out;
  }
  return value;
}

export function toGeminiFunctionDeclarations(tools: AiTool[]): GeminiFunctionDeclaration[] {
  return tools.map((t) => {
    const params = uppercaseTypes(t.definition.input_schema) as {
      type: 'OBJECT';
      properties?: Record<string, unknown>;
      required?: string[];
    };
    return {
      name: t.definition.name,
      description: t.definition.description,
      parameters: params,
    };
  });
}
