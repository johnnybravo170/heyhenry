'use client';

/**
 * Mounts inside the dashboard layout to attach the current user + tenant
 * UUIDs to the browser-side Sentry scope. Server-side tagging happens in
 * getCurrentTenant() — this is the client-only counterpart so browser
 * errors land in the same tenant bucket.
 *
 * No PII: only UUIDs and the plan tier (used for prioritising errors).
 */

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export function SentryUserContext({
  userId,
  tenantId,
  tenantPlan,
  tenantVertical,
}: {
  userId: string;
  tenantId: string;
  tenantPlan: string;
  tenantVertical: string;
}) {
  useEffect(() => {
    Sentry.setUser({ id: userId });
    Sentry.setTag('tenant_id', tenantId);
    Sentry.setTag('tenant_plan', tenantPlan);
    Sentry.setTag('tenant_vertical', tenantVertical);
  }, [userId, tenantId, tenantPlan, tenantVertical]);

  return null;
}
