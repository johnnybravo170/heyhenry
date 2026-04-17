import { getCurrentTenant } from '@/lib/auth/helpers';
import { getJob, listJobs, listWorklogForJob } from '@/lib/db/queries/jobs';
import { createClient } from '@/lib/supabase/server';
import {
  formatCad,
  formatDate,
  formatDateTime,
  invoiceStatusLabels,
  jobStatusLabels,
} from '../format';
import { resolveByShortId } from '../helpers/resolve-by-short-id';
import { resolveCustomer } from '../helpers/resolve-customer';
import type { AiTool } from '../types';

export const jobTools: AiTool[] = [
  {
    definition: {
      name: 'list_jobs',
      description:
        'List jobs. Filter by status (booked/in_progress/complete/cancelled) or customer.',
      input_schema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['booked', 'in_progress', 'complete', 'cancelled'],
            description: 'Filter by job status',
          },
          customer_id: {
            type: 'string',
            description: 'Filter by customer UUID',
          },
          limit: {
            type: 'number',
            description: 'Max results (default 20, max 100)',
          },
        },
      },
    },
    handler: async (input) => {
      try {
        const rows = await listJobs({
          status: input.status as 'booked' | 'in_progress' | 'complete' | 'cancelled' | undefined,
          customer_id: input.customer_id as string | undefined,
          limit: Math.min((input.limit as number) || 20, 100),
        });

        if (rows.length === 0) {
          return 'No jobs found matching your criteria.';
        }

        let output = `Found ${rows.length} job(s):\n\n`;
        for (let i = 0; i < rows.length; i++) {
          const j = rows[i];
          output += `${i + 1}. ${j.customer?.name ?? 'No customer'}\n`;
          output += `   Status: ${jobStatusLabels[j.status] ?? j.status}`;
          if (j.scheduled_at) output += ` | Scheduled: ${formatDateTime(j.scheduled_at)}`;
          if (j.completed_at) output += ` | Completed: ${formatDate(j.completed_at)}`;
          output += '\n';
          if (j.notes) output += `   Notes: ${j.notes}\n`;
          output += `   ID: ${j.id}\n\n`;
        }

        return output;
      } catch (e) {
        return `Failed to list jobs: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
  {
    definition: {
      name: 'get_job',
      description:
        'Get full job details including customer, quote link, invoice link, and recent worklog entries.',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Job UUID' },
        },
        required: ['id'],
      },
    },
    handler: async (input) => {
      try {
        const job = await getJob(input.id as string);
        if (!job) {
          return 'Job not found.';
        }

        const worklog = await listWorklogForJob(job.id);

        let output = `Job Details\n${'='.repeat(40)}\n\n`;
        output += `Customer: ${job.customer?.name ?? 'N/A'}\n`;
        output += `Status: ${jobStatusLabels[job.status] ?? job.status}\n`;
        if (job.scheduled_at) output += `Scheduled: ${formatDateTime(job.scheduled_at)}\n`;
        if (job.started_at) output += `Started: ${formatDateTime(job.started_at)}\n`;
        if (job.completed_at) output += `Completed: ${formatDateTime(job.completed_at)}\n`;
        if (job.notes) output += `Notes: ${job.notes}\n`;

        if (job.quote) {
          output += `\nLinked Quote: ${job.quote.id}\n`;
          output += `  Quote Total: ${formatCad(job.quote.total_cents)}\n`;
          output += `  Quote Status: ${job.quote.status}\n`;
        }

        if (job.invoices.length > 0) {
          output += `\nLinked Invoice(s)\n${'-'.repeat(20)}\n`;
          for (const inv of job.invoices) {
            output += `  ${inv.id} - ${invoiceStatusLabels[inv.status] ?? inv.status} - ${formatCad(inv.amount_cents + inv.tax_cents)}\n`;
          }
        }

        if (worklog.length > 0) {
          output += `\nRecent Worklog\n${'-'.repeat(30)}\n`;
          for (const w of worklog.slice(0, 5)) {
            output += `  [${formatDate(w.created_at)}] ${w.title ?? '(no title)'}`;
            if (w.body) output += ` - ${w.body}`;
            output += '\n';
          }
        }

        return output;
      } catch (e) {
        return `Failed to get job: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
  {
    definition: {
      name: 'update_job_status',
      description:
        "Change a job's status and log the transition to the worklog. Sets started_at/completed_at timestamps automatically.",
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Job UUID' },
          status: {
            type: 'string',
            enum: ['booked', 'in_progress', 'complete', 'cancelled'],
            description: 'New status',
          },
        },
        required: ['id', 'status'],
      },
    },
    handler: async (input) => {
      try {
        const tenant = await getCurrentTenant();
        if (!tenant) return 'Not authenticated.';

        const supabase = await createClient();
        const jobId = input.id as string;
        const newStatus = input.status as string;

        // Load current job
        const { data: job, error: loadErr } = await supabase
          .from('jobs')
          .select('id, status, started_at, completed_at, customers:customer_id (name)')
          .eq('id', jobId)
          .is('deleted_at', null)
          .maybeSingle();

        if (loadErr || !job) {
          return 'Job not found.';
        }

        const oldStatus = job.status as string;
        if (oldStatus === newStatus) {
          return `Job is already ${jobStatusLabels[newStatus] ?? newStatus}. No change needed.`;
        }

        // Build update
        const now = new Date().toISOString();
        const updateFields: Record<string, unknown> = {
          status: newStatus,
          updated_at: now,
        };
        if (newStatus === 'in_progress' && !job.started_at) {
          updateFields.started_at = now;
        }
        if (newStatus === 'complete' && !job.completed_at) {
          updateFields.completed_at = now;
        }

        const { error: updateErr } = await supabase
          .from('jobs')
          .update(updateFields)
          .eq('id', jobId);

        if (updateErr) {
          return `Failed to update job: ${updateErr.message}`;
        }

        // Extract customer name from Supabase join
        const customerRaw = job.customers as unknown;
        const customerObj = Array.isArray(customerRaw) ? customerRaw[0] : customerRaw;
        const customerName =
          customerObj && typeof customerObj === 'object' && 'name' in customerObj
            ? (customerObj as { name: string }).name
            : 'customer';

        // Log to worklog
        await supabase.from('worklog_entries').insert({
          tenant_id: tenant.id,
          entry_type: 'system',
          title: 'Job status changed',
          body: `Job for ${customerName} moved from ${jobStatusLabels[oldStatus] ?? oldStatus} to ${jobStatusLabels[newStatus] ?? newStatus}.`,
          related_type: 'job',
          related_id: jobId,
        });

        return (
          `Job status updated: ${jobStatusLabels[oldStatus] ?? oldStatus} -> ${jobStatusLabels[newStatus] ?? newStatus}\n` +
          `Customer: ${customerName}\nJob ID: ${jobId}`
        );
      } catch (e) {
        return `Failed to update job status: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
  {
    definition: {
      name: 'create_job',
      description:
        'Create a new job for a customer. Optionally schedule it for a specific date/time and link to an existing quote.',
      input_schema: {
        type: 'object',
        properties: {
          customer_name_or_id: {
            type: 'string',
            description: 'Customer name (fuzzy match) or UUID',
          },
          scheduled_at: {
            type: 'string',
            description: 'ISO date/time for when the job is scheduled (e.g. 2026-04-22T09:00)',
          },
          quote_id: {
            type: 'string',
            description: 'Link to an existing quote UUID or short ID',
          },
          notes: { type: 'string', description: 'Job notes' },
        },
        required: ['customer_name_or_id'],
      },
    },
    handler: async (input) => {
      try {
        const tenant = await getCurrentTenant();
        if (!tenant) return 'Not authenticated.';

        const resolved = await resolveCustomer(input.customer_name_or_id as string);
        if (typeof resolved === 'string') return resolved;

        // Resolve quote if provided
        let quoteId: string | null = null;
        if (input.quote_id) {
          const quoteResult = await resolveByShortId<{ id: string }>(
            'quotes',
            input.quote_id as string,
            'id',
          );
          if (typeof quoteResult === 'string') return `Quote lookup failed: ${quoteResult}`;
          quoteId = quoteResult.id;
        }

        const scheduledAt = input.scheduled_at ? String(input.scheduled_at) : null;

        const supabase = await createClient();
        const { data: job, error } = await supabase
          .from('jobs')
          .insert({
            tenant_id: tenant.id,
            customer_id: resolved.id,
            quote_id: quoteId,
            status: 'booked',
            scheduled_at: scheduledAt,
            notes: (input.notes as string) ?? null,
          })
          .select('id')
          .single();

        if (error || !job) {
          return `Failed to create job: ${error?.message ?? 'Unknown error'}`;
        }

        // Add worklog entry
        await supabase.from('worklog_entries').insert({
          tenant_id: tenant.id,
          entry_type: 'system',
          title: 'Job booked',
          body: `Job booked for ${resolved.name}${scheduledAt ? ` on ${formatDateTime(scheduledAt)}` : ''}.`,
          related_type: 'job',
          related_id: job.id,
        });

        let response = `Job booked for ${resolved.name}`;
        if (scheduledAt) response += ` on ${formatDateTime(scheduledAt)}`;
        response += `. Status: booked. ID: ${job.id.slice(0, 8)}`;

        return response;
      } catch (e) {
        return `Failed to create job: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
  {
    definition: {
      name: 'schedule_job',
      description: 'Schedule or reschedule a job for a specific date/time.',
      input_schema: {
        type: 'object',
        properties: {
          job_id: {
            type: 'string',
            description: 'Job UUID or short ID (first 8 chars)',
          },
          scheduled_at: {
            type: 'string',
            description: 'ISO date/time (e.g. 2026-04-22T09:00)',
          },
        },
        required: ['job_id', 'scheduled_at'],
      },
    },
    handler: async (input) => {
      try {
        const tenant = await getCurrentTenant();
        if (!tenant) return 'Not authenticated.';

        type JobRow = {
          id: string;
          status: string;
          customers: { name: string } | { name: string }[];
        };

        const result = await resolveByShortId<JobRow>(
          'jobs',
          input.job_id as string,
          'id, status, customers:customer_id (name)',
        );
        if (typeof result === 'string') return result;

        const job = result;
        const scheduledAt = String(input.scheduled_at);
        const now = new Date().toISOString();

        const supabase = await createClient();
        const { error } = await supabase
          .from('jobs')
          .update({ scheduled_at: scheduledAt, updated_at: now })
          .eq('id', job.id);

        if (error) {
          return `Failed to schedule job: ${error.message}`;
        }

        const customerRaw = job.customers;
        const customer = Array.isArray(customerRaw) ? customerRaw[0] : customerRaw;
        const customerName = customer?.name ?? 'customer';

        // Add worklog entry
        await supabase.from('worklog_entries').insert({
          tenant_id: tenant.id,
          entry_type: 'system',
          title: 'Job rescheduled',
          body: `Job for ${customerName} scheduled to ${formatDateTime(scheduledAt)}.`,
          related_type: 'job',
          related_id: job.id,
        });

        return `Job for ${customerName} rescheduled to ${formatDateTime(scheduledAt)}.`;
      } catch (e) {
        return `Failed to schedule job: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
];
