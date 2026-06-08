/**
 * Rewrite a JSON schema to satisfy OpenAI structured-outputs **strict mode**.
 *
 * OpenAI (with `response_format.json_schema.strict = true`) requires, for
 * every object node:
 *   - `additionalProperties: false`
 *   - every key in `properties` also listed in `required`
 * and models "optional" fields as nullable (`type: ['string','null']`)
 * rather than by omission from `required`.
 *
 * Gemini — the gateway's primary for most structured tasks — is forgiving
 * and needs none of this. So schemas authored for the Gemini path 400 on
 * the OpenAI fallback ("Invalid schema for response_format ...
 * 'additionalProperties' is required to be supplied and to be false"),
 * which silently kills the gemini→openai fallback chain. This transform
 * makes any gateway schema valid on OpenAI without changing its meaning:
 * a property that was optional becomes nullable + required, i.e. "may be
 * absent" becomes "may be null" — which our downstream Zod parse already
 * tolerates.
 *
 * Pure and non-mutating: returns a new schema, leaves the input untouched.
 * Idempotent: running it on an already-strict schema is a no-op.
 */
export function toOpenAiStrictSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map((s) => toOpenAiStrictSchema(s));
  if (!schema || typeof schema !== 'object') return schema;

  const node = schema as Record<string, unknown>;
  const originalRequired = new Set(
    Array.isArray(node.required)
      ? (node.required as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
  );

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'properties' && value && typeof value === 'object' && !Array.isArray(value)) {
      const props = value as Record<string, unknown>;
      const rewritten: Record<string, unknown> = {};
      for (const [propName, propSchema] of Object.entries(props)) {
        const child = toOpenAiStrictSchema(propSchema);
        // Strict mode requires every property in `required`; preserve the
        // original optionality by making formerly-optional fields nullable.
        rewritten[propName] = originalRequired.has(propName) ? child : makeNullable(child);
      }
      out[key] = rewritten;
    } else {
      out[key] = toOpenAiStrictSchema(value);
    }
  }

  // Tighten every object node that declares properties.
  if (out.properties && typeof out.properties === 'object' && !Array.isArray(out.properties)) {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties as Record<string, unknown>);
  }

  return out;
}

/**
 * Add `'null'` to a node's `type` so a previously-optional field can be
 * marked required (strict mode) while still permitting "no value". Only
 * touches nodes with a concrete `type`; anyOf/$ref/enum nodes are left
 * untouched (can't be safely null-wrapped and are rare in gateway schemas).
 */
function makeNullable(node: unknown): unknown {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
  const next = { ...(node as Record<string, unknown>) };
  const type = next.type;
  if (typeof type === 'string') {
    if (type !== 'null') next.type = [type, 'null'];
  } else if (Array.isArray(type) && !type.includes('null')) {
    next.type = [...type, 'null'];
  }
  return next;
}
