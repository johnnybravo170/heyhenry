/**
 * Calendar-specific job queries.
 *
 * These queries return jobs within a date range for the calendar views.
 * Tenant isolation is enforced by RLS (same as jobs.ts).
 */

import { createClient } from '@/lib/supabase/server';
import type { JobWithCustomer } from './jobs';

const JOB_COLUMNS =
  'id, tenant_id, customer_id, quote_id, status, scheduled_at, started_at, completed_at, notes, created_at, updated_at, deleted_at';

const JOB_WITH_CUSTOMER_SELECT = `${JOB_COLUMNS}, customers:customer_id (id, name, type)`;

type CustomerRaw = { id: string; name: string; type: string } | null;

function normalizeJob(row: Record<string, unknown>): JobWithCustomer {
  const { customers: customerRaw, ...rest } = row;
  const candidate = Array.isArray(customerRaw)
    ? (customerRaw[0] as CustomerRaw)
    : (customerRaw as CustomerRaw);
  return {
    ...(rest as JobWithCustomer),
    customer: candidate
      ? {
          id: candidate.id,
          name: candidate.name,
          type: candidate.type as 'residential' | 'commercial' | 'agent',
        }
      : null,
  };
}

/**
 * Fetch jobs where `scheduled_at` falls within the given month.
 * Month is 1-indexed (1 = January).
 */
export async function getJobsForMonth(year: number, month: number): Promise<JobWithCustomer[]> {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1)); // first of next month

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_WITH_CUSTOMER_SELECT)
    .is('deleted_at', null)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', startDate.toISOString())
    .lt('scheduled_at', endDate.toISOString())
    .order('scheduled_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load calendar jobs: ${error.message}`);
  }
  return (data ?? []).map((row) => normalizeJob(row as Record<string, unknown>));
}

/**
 * Fetch jobs for a 7-day window starting at `startDate`.
 */
export async function getJobsForWeek(startDate: string): Promise<JobWithCustomer[]> {
  const start = new Date(startDate);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_WITH_CUSTOMER_SELECT)
    .is('deleted_at', null)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', start.toISOString())
    .lt('scheduled_at', end.toISOString())
    .order('scheduled_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load week jobs: ${error.message}`);
  }
  return (data ?? []).map((row) => normalizeJob(row as Record<string, unknown>));
}

/**
 * Fetch all jobs for the calendar by worker assignment.
 * For now returns all jobs (single operator). When `assigned_to` is added
 * to the jobs table, this will group by worker.
 */
export async function getJobsForMonthByWorker(
  year: number,
  month: number,
): Promise<JobWithCustomer[]> {
  // Future: group by assigned_to. For now, same as getJobsForMonth.
  return getJobsForMonth(year, month);
}
