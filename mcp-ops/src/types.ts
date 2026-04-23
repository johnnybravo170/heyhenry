/**
 * Shared MCP result helpers. Tools should return human-readable text rather
 * than raw JSON dumps — the agent reads the response, the user usually does
 * not.
 */

export function textResult(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
  };
}

export function errorResult(message: string) {
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true,
  };
}

/** Format a JS Date / ISO string as a short readable date-time. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return 'N/A';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Pretty-print an unknown value as a single-line summary. */
export function shortJson(value: unknown, max = 120): string {
  const s = JSON.stringify(value);
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}...` : s;
}
