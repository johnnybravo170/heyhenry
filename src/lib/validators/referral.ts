/**
 * Zod validators for the referral system.
 */

import { z } from 'zod';

export const referralEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Enter a valid email address.' }),
});

/**
 * E.164 phone number: + followed by 1-15 digits.
 * Example: +16045551234
 */
export const referralSMSSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, {
      message: 'Enter a valid phone number in E.164 format (e.g. +16045551234).',
    }),
});

export type ReferralEmailInput = z.infer<typeof referralEmailSchema>;
export type ReferralSMSInput = z.infer<typeof referralSMSSchema>;
