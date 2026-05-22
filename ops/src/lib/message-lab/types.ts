/**
 * Message Lab domain types + zod schemas.
 *
 * The engine asks each archetype for a structured JSON reaction. Zod is the
 * trust boundary: if a model returns garbage we fall back to a stub so one
 * bad reaction doesn't kill the whole eval.
 */

import { z } from 'zod';

// ---- Archetypes ------------------------------------------------------

export const evidenceBasisSchema = z.enum(['observed', 'inferred', 'mixed']);
export const archetypeStatusSchema = z.enum(['active', 'retired']);

export const archetypeSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  vertical: z.string(),
  name: z.string(),
  tagline: z.string(),
  emoji: z.string(),
  evidence_basis: evidenceBasisSchema,
  confidence: z.string(),
  prevalence_note: z.string(),
  attractiveness_rank: z.number().int().nullable(),
  knowledge_id: z.string().uuid().nullable(),
  status: archetypeStatusSchema,
  sort_order: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Archetype = z.infer<typeof archetypeSchema>;

export const archetypeWithDossierSchema = archetypeSchema.extend({
  dossier: z.string().nullable(),
});
export type ArchetypeWithDossier = z.infer<typeof archetypeWithDossierSchema>;

// ---- Evals -----------------------------------------------------------

export const messageTypeSchema = z.enum([
  'ad',
  'email',
  'landing_page',
  'sales_page',
  'sms',
  'headline',
  'social_post',
  'other',
]);
export type MessageType = z.infer<typeof messageTypeSchema>;

export const evalStatusSchema = z.enum(['pending', 'running', 'done', 'failed']);

export const messageEvalSchema = z.object({
  id: z.string().uuid(),
  vertical: z.string(),
  message_type: messageTypeSchema,
  goal: z.string(),
  input_text: z.string().nullable(),
  input_url: z.string().nullable(),
  status: evalStatusSchema,
  archetype_ids: z.array(z.string().uuid()),
  model_override: z.string().nullable(),
  provider_override: z.string().nullable(),
  buy_count: z.number().int(),
  no_buy_count: z.number().int(),
  objections: z.array(z.string()),
  budget_cents: z.number(),
  spent_cents: z.number(),
  error_message: z.string().nullable(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
});
export type MessageEval = z.infer<typeof messageEvalSchema>;

// ---- Reactions -------------------------------------------------------

export const reactionDecisionSchema = z.enum(['buy', 'no_buy']);

export const reactionCommentsSchema = z.object({
  relates: z.string(),
  appeals: z.string(),
  turns_off: z.string(),
  would_make_buy: z.string(),
});
export type ReactionComments = z.infer<typeof reactionCommentsSchema>;

export const messageEvalReactionSchema = z.object({
  id: z.string().uuid(),
  eval_id: z.string().uuid(),
  archetype_id: z.string().uuid(),
  decision: reactionDecisionSchema,
  reason: z.string(),
  comments: reactionCommentsSchema.partial().nullable(),
  raw_text: z.string().nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  prompt_tokens: z.number().int().nullable(),
  completion_tokens: z.number().int().nullable(),
  cost_cents: z.number().nullable(),
  latency_ms: z.number().int().nullable(),
  created_at: z.string(),
});
export type MessageEvalReaction = z.infer<typeof messageEvalReactionSchema>;

// ---- Engine I/O (what we ask each archetype to produce) --------------

/** The single structured object every archetype returns. Generous string
 *  limits — we'd rather carry a long reaction than fail the parse. */
export const reactionOutputSchema = z.object({
  decision: reactionDecisionSchema,
  reason: z.string().min(1).max(4000),
  relates: z.string().max(4000).default(''),
  appeals: z.string().max(4000).default(''),
  turns_off: z.string().max(4000).default(''),
  would_make_buy: z.string().max(4000).default(''),
});
export type ReactionOutput = z.infer<typeof reactionOutputSchema>;

// ---- Aggregate result (what callers / the MCP tool get back) ---------

export type ArchetypeVerdict = {
  archetype_id: string;
  slug: string;
  name: string;
  emoji: string;
  evidence_basis: Archetype['evidence_basis'];
  attractiveness_rank: number | null;
  decision: 'buy' | 'no_buy';
  reason: string;
  comments: Partial<ReactionComments> | null;
};

export type EvalResult = {
  eval_id: string;
  status: MessageEval['status'];
  message_type: MessageType;
  buy_count: number;
  no_buy_count: number;
  total: number;
  /** buy_count / total, 0-1. Raw count is the headline; this is convenience. */
  buy_ratio: number;
  verdicts: ArchetypeVerdict[];
  /** Collated themes across the no_buy reasons — the writing-agent punch list. */
  objections: string[];
  spent_cents: number;
};
