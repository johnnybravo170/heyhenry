/**
 * Lightweight Handlebars-style merge tag renderer for AR templates.
 *
 * Supports {{key}} and {{nested.key}} substitution. Unknown keys render as
 * empty string. That's intentional — templates should degrade gracefully
 * rather than leak raw {{first_name}} into a send.
 */

const TAG = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function renderTemplate(source: string, vars: Record<string, unknown>): string {
  return source.replace(TAG, (_, key) => {
    const val = resolvePath(vars, key);
    return val == null ? '' : String(val);
  });
}

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as object)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}
