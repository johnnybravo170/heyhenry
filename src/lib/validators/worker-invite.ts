/**
 * Zod validators for worker signup (via invite link).
 *
 * Workers join an existing tenant, so there is no businessName field.
 * The password rule matches the one in auth.ts.
 */

import { z } from 'zod';

const passwordRule = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters long.' })
  .regex(/[a-zA-Z]/, { message: 'Password must contain at least one letter.' })
  .regex(/[0-9]/, { message: 'Password must contain at least one number.' });

export const workerSignupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Name is required.' })
    .max(100, { message: 'Name must be at most 100 characters.' }),
  email: z.string().trim().toLowerCase().email({ message: 'Enter a valid email address.' }),
  password: passwordRule,
  inviteCode: z.string().min(1, { message: 'Invite code is required.' }),
});

export type WorkerSignupInput = z.infer<typeof workerSignupSchema>;
