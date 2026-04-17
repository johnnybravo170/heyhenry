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
];
