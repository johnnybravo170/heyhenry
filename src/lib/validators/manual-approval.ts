/**
 * Shared constants for manual-approval flows (estimate + change order).
 * Lives outside the `'use server'` action file so both client dialog
 * and server action can import without Next's server-only constraints.
 */

export const MANUAL_APPROVAL_METHODS = [
  'manual_text',
  'manual_phone',
  'manual_inperson',
  'manual_email',
] as const;
export type ManualApprovalMethod = (typeof MANUAL_APPROVAL_METHODS)[number];

export const manualApprovalMethodLabels: Record<ManualApprovalMethod, string> = {
  manual_text: 'Text message',
  manual_phone: 'Phone call',
  manual_inperson: 'In person',
  manual_email: 'Email',
};
