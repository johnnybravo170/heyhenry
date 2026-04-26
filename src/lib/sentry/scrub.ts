/**
 * Shared Sentry beforeSend scrubber. PIPEDA / privacy-first defaults:
 *
 * - Strip request bodies (server actions, route handler payloads can carry
 *   PII — names, addresses, photo URLs).
 * - Strip cookies + auth headers from request context.
 * - Strip IP addresses (Sentry stores them by default).
 * - Strip user.email / user.username — only the UUID is kept (set in
 *   instrumentation via Sentry.setUser).
 *
 * Sentry's `sendDefaultPii: false` covers most of this, but `beforeSend`
 * is the belt to that suspenders — explicit + auditable in one place.
 */

import type { ErrorEvent, EventHint } from '@sentry/nextjs';

export function scrubEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  if (event.request) {
    event.request.cookies = undefined;
    event.request.data = undefined;
    if (event.request.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.authorization;
      delete event.request.headers['x-supabase-auth'];
    }
  }

  if (event.user) {
    event.user = { id: event.user.id };
  }

  return event;
}
