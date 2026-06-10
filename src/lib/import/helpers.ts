import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

export const FORBIDDEN_LINE_LABEL = /gst|hst|pst|management fee|subtotal|total/i;

/** Coerce a value to an integer number of cents. Throws if not a safe integer. */
export function assertCents(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ImportValidationError(`${path} must be a non-negative integer (cents)`, path);
  }
  return value;
}

/** Parse an ISO date string (YYYY-MM-DD). Returns null for null/undefined. */
export function parseIsoDate(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ImportValidationError(`${path} must be an ISO date string (YYYY-MM-DD)`, path);
  }
  return value;
}

export function parseIsoDateOptional(value: unknown, path: string): string | null {
  if (value === undefined || value === null) return null;
  return parseIsoDate(value, path);
}

export class ImportValidationError extends Error {
  readonly path: string;
  constructor(message: string, path: string) {
    super(message);
    this.path = path;
  }
}

export type DryRunEnvelope<T> = {
  ok: true;
  dry_run: true;
  section: string;
  parsed: T;
  count: number;
};

export function dryRunEnvelope<T>(section: string, parsed: T, count: number): DryRunEnvelope<T> {
  return { ok: true, dry_run: true, section, parsed, count };
}

export function validationErrorResponse(
  issues: { message: string; path: string | string[] }[],
): NextResponse {
  return NextResponse.json({ error: 'validation', issues }, { status: 422 });
}

export function zodErrorResponse(err: ZodError): NextResponse {
  return validationErrorResponse(
    err.issues.map((i) => ({ message: i.message, path: i.path.join('.') })),
  );
}

export function worklogEntry(
  tenantId: string,
  title: string,
  body: string,
  relatedType: string,
  relatedId: string,
) {
  return {
    tenant_id: tenantId,
    entry_type: 'system' as const,
    title,
    body,
    related_type: relatedType,
    related_id: relatedId,
  };
}
