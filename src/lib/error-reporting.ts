/**
 * Error reporting abstraction.
 *
 * Currently logs to console. When a Sentry DSN is configured, swap the
 * implementation here — every server action already calls `reportError()`.
 */

export function reportError(error: unknown, context?: Record<string, unknown>) {
  console.error('[error]', error, context);
  // TODO: wire to Sentry when DSN is configured
  //   Sentry.captureException(error, { extra: context });
}
