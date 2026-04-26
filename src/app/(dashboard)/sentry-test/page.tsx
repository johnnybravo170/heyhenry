/**
 * Temporary smoke-test page for Sentry → ops pipeline verification.
 * Lives under (dashboard) so getCurrentTenant() runs and tenant tags
 * attach to the captured error. Delete after verification.
 */

import { requireTenant } from '@/lib/auth/helpers';

export default async function SentryTestPage() {
  await requireTenant();
  throw new Error('Sentry pipeline smoke test — should land in ops with full tenant tags');
}
