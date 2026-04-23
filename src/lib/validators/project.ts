/**
 * Zod validators for project forms and server actions.
 *
 * Same dual-use pattern as job.ts: client (React Hook Form) + server actions.
 */

import { z } from 'zod';

/**
 * Lifecycle stages live on projects.lifecycle_stage (TEXT + CHECK).
 * The UI label everywhere still says "Status" — we only renamed at the
 * DB layer to kill ambiguity. See PROJECT_LIFECYCLE_PLAN.md.
 */
export const lifecycleStages = [
  'planning',
  'awaiting_approval',
  'active',
  'on_hold',
  'declined',
  'complete',
  'cancelled',
] as const;
export type LifecycleStage = (typeof lifecycleStages)[number];

export const lifecycleStageLabels: Record<LifecycleStage, string> = {
  planning: 'Planning',
  awaiting_approval: 'Awaiting approval',
  active: 'Active',
  on_hold: 'On hold',
  declined: 'Declined',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

export const projectCreateSchema = z.object({
  customer_id: z.string().uuid({ message: 'Pick a customer.' }),
  name: z
    .string()
    .trim()
    .min(1, { message: 'Project name is required.' })
    .max(200, { message: 'Name must be at most 200 characters.' }),
  description: z
    .string()
    .trim()
    .max(2000, { message: 'Description must be at most 2000 characters.' })
    .optional()
    .or(z.literal('')),
  start_date: z.string().optional().or(z.literal('')),
  target_end_date: z.string().optional().or(z.literal('')),
  management_fee_rate: z.coerce
    .number()
    .min(0, { message: 'Fee rate cannot be negative.' })
    .max(1, { message: 'Fee rate cannot exceed 100%.' })
    .default(0.12),
});

export const projectUpdateSchema = projectCreateSchema.extend({
  id: z.string().uuid({ message: 'Invalid project id.' }),
  percent_complete: z.coerce
    .number()
    .int()
    .min(0, { message: 'Cannot be negative.' })
    .max(100, { message: 'Cannot exceed 100%.' })
    .optional(),
});

export const lifecycleStageChangeSchema = z.object({
  id: z.string().uuid({ message: 'Invalid project id.' }),
  stage: z.enum(lifecycleStages),
});

export type ProjectInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type LifecycleStageChangeInput = z.infer<typeof lifecycleStageChangeSchema>;

export function emptyToNull(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
