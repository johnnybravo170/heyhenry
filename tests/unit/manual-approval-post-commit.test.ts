/**
 * Regression guard for the "Mark approved shows an error but actually
 * succeeded" bug (Charlie founding-member session; ops doc cd85d021).
 *
 * Root cause: manuallyApproveEstimateAction flips the estimate to `approved`
 * and commits, THEN runs post-commit side effects (project_events insert,
 * worklog insert, scope snapshot). A throw in any of those propagated out of
 * the server action and tripped the route error boundary — the operator saw
 * an error even though the approval had already committed, and only a refresh
 * revealed the truth.
 *
 * The fix wraps the post-commit side effects in try/catch so a side-effect
 * failure never masquerades as an approval failure. This test pins that:
 * with the scope snapshot throwing, the action must still resolve
 * `{ ok: true }` rather than reject.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// revalidatePath needs a Next request store that doesn't exist in unit tests.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// Make snapshotProjectScope throw — the post-commit step that was bubbling up.
vi.mock('@/lib/db/queries/project-scope-snapshots', () => ({
  snapshotProjectScope: vi.fn(async () => {
    throw new Error('snapshot blew up');
  }),
}));

let projectUpdate: Record<string, unknown> | null = null;

// Minimal fluent admin-client mock covering the query shapes the action uses:
//   - projects: select(...).eq.eq.single() then update(...).eq()
//   - project_events / worklog_entries: insert(...)
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'projects') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'proj-1',
                    tenant_id: 'tenant-1',
                    name: 'Test Project',
                    estimate_status: 'pending_approval',
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            projectUpdate = payload;
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      // project_events / worklog_entries
      return { insert: async () => ({ error: null }) };
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
      }),
    },
  }),
}));

vi.mock('@/lib/auth/helpers', () => ({
  getCurrentTenant: async () => ({ id: 'tenant-1', member: { id: 'member-1' } }),
  getCurrentUser: async () => ({ id: 'user-1' }),
}));

import { manuallyApproveEstimateAction } from '@/server/actions/manual-approval';

function buildFormData() {
  const fd = new FormData();
  fd.append('project_id', 'proj-1');
  fd.append('method', 'manual_text');
  fd.append('customer_name', 'Jane Customer');
  return fd;
}

describe('manuallyApproveEstimateAction post-commit resilience', () => {
  beforeEach(() => {
    projectUpdate = null;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok even when a post-commit side effect throws (no false error)', async () => {
    // Must resolve, not reject — a reject is what tripped the error boundary.
    const result = await manuallyApproveEstimateAction(buildFormData());

    expect(result).toEqual({ ok: true, id: 'proj-1' });
  });

  it('has already committed the approved status before the side effect runs', async () => {
    await manuallyApproveEstimateAction(buildFormData());

    expect(projectUpdate).toMatchObject({
      estimate_status: 'approved',
      lifecycle_stage: 'active',
      estimate_approved_by_name: 'Jane Customer',
    });
  });
});
