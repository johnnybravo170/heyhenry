import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { messageTypeSchema } from '@/lib/message-lab/types';
import { listArchetypes, runMessageEval } from '@/server/ops-services/message-lab';
import { jsonResult, type McpToolCtx, withAudit } from './context';

const DEFAULT_VERTICAL = 'general_contractor';

export function registerMessageLabTools(server: McpServer, ctx: McpToolCtx) {
  server.tool(
    'archetypes_list',
    'List the synthetic customer archetypes that make up a Message Lab panel. Optional `vertical` (default general_contractor).',
    {
      vertical: z.string().max(64).default(DEFAULT_VERTICAL),
      include_retired: z.boolean().default(false),
    },
    withAudit(ctx, 'archetypes_list', 'read:message_lab', async ({ vertical, include_retired }) => {
      const rows = await listArchetypes({ vertical, include_retired });
      return jsonResult({
        vertical,
        count: rows.length,
        archetypes: rows.map((a) => ({
          id: a.id,
          slug: a.slug,
          name: a.name,
          tagline: a.tagline,
          evidence_basis: a.evidence_basis,
          confidence: a.confidence,
          attractiveness_rank: a.attractiveness_rank,
        })),
      });
    }),
  );

  server.tool(
    'message_eval_run',
    [
      'Run a piece of marketing copy past the synthetic customer-archetype focus group. Each archetype is sampled several times and majority-votes a buy/no-buy lean, with reasons.',
      'Use this BEFORE shipping ad/email/landing/sales copy. The PRIMARY output is qualitative: `objections` (the deduplicated punch list to rewrite against) and each archetype’s reason.',
      'IMPORTANT: `panel_lean` is a COMPARATIVE signal only — use it to A/B drafts on the same panel ("v2 beat v1, 6 vs 4"), NOT as a conversion forecast. LLM panels skew agreeable, so the absolute number runs high; trust the deltas and the reasons, not the percentage.',
      'Runs synchronously (~20-40s).',
    ].join(' '),
    {
      copy: z.string().min(1).max(40_000).describe('The marketing copy to test.'),
      message_type: messageTypeSchema
        .default('other')
        .describe('What kind of artifact this is — shifts the reading lens.'),
      goal: z
        .string()
        .max(2000)
        .default('')
        .describe(
          'What the company is trying to achieve with this piece. Optional but improves accuracy.',
        ),
      vertical: z.string().max(64).default(DEFAULT_VERTICAL),
      archetype_ids: z
        .array(z.string().uuid())
        .max(30)
        .optional()
        .describe(
          'Restrict to specific archetypes. Omit to run the whole active panel for the vertical.',
        ),
      budget_cents: z.number().int().min(10).max(500).default(50),
    },
    withAudit(
      ctx,
      'message_eval_run',
      'write:message_lab',
      async ({ copy, message_type, goal, vertical, archetype_ids, budget_cents }) => {
        const ids =
          archetype_ids && archetype_ids.length > 0
            ? archetype_ids
            : (await listArchetypes({ vertical })).map((a) => a.id);
        if (ids.length === 0) {
          throw new Error(`no active archetypes for vertical '${vertical}' — seed the panel first`);
        }

        const result = await runMessageEval(
          {
            vertical,
            message_type,
            goal,
            input_text: copy,
            archetype_ids: ids,
            budget_cents,
          },
          { key_id: ctx.keyId },
        );

        return jsonResult({
          eval_id: result.eval_id,
          // Qualitative first — this is what to act on.
          objections: result.objections,
          verdicts: result.verdicts.map((v) => ({
            archetype: v.name,
            decision: v.decision,
            lean: `${v.buy_votes}/${v.sample_count} buy`,
            reason: v.reason,
            turns_off: v.comments?.turns_off ?? '',
            would_make_buy: v.comments?.would_make_buy ?? '',
            evidence_basis: v.evidence_basis,
            attractiveness_rank: v.attractiveness_rank,
          })),
          // Comparative signal only — see tool description.
          panel_lean: `${result.buy_count}/${result.total} archetypes lean buy`,
          panel_lean_note:
            'Comparative instrument, NOT a conversion forecast. Compare against another draft run on the same panel; trust the delta and the reasons, not this number.',
          buy_count: result.buy_count,
          no_buy_count: result.no_buy_count,
          spent_cents: result.spent_cents,
        });
      },
    ),
  );
}
