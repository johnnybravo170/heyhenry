/**
 * MCP tools for ops.scout_policy — the producer-learner policy substrate.
 *
 * Read tools are open to anything with `read:ideas`. Write tools require
 * `write:ideas` (matching the scope model of the rest of the ideas surface
 * — scout policy is tightly coupled to the ideas concern, no need for a
 * separate scope group).
 *
 * Activation (flipping 'proposed' to 'active') is deliberately NOT exposed
 * via MCP. That's an admin server action — Jonathan reviews + activates
 * via the UI, agents propose only. See ops-services/scout-policy.ts.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getActiveScoutPolicy,
  getScoutPolicyHistory,
  proposeScoutPolicy,
} from '@/server/ops-services/scout-policy';
import { jsonResult, type McpToolCtx, withAudit } from './context';

export function registerScoutPolicyTools(server: McpServer, ctx: McpToolCtx) {
  server.tool(
    'scout_policy_get',
    [
      "Read a scout's currently-active policy. Call this at the start of every scout run to apply your learned file-or-skip rules.",
      '',
      '`scout_slug` is your routine slug (your `actor_name`, e.g. "business-scout") — match what you pass on ideas_add.',
      '',
      'Returns null `policy` if no version has been activated yet — treat that as "no learned overrides; run the baseline prompt unchanged." Future scout-learner runs will populate this.',
    ].join('\n'),
    {
      scout_slug: z.string().min(1).max(100),
    },
    withAudit(ctx, 'scout_policy_get', 'read:ideas', async ({ scout_slug }) => {
      const row = await getActiveScoutPolicy(scout_slug);
      return jsonResult({ scout_slug, policy: row });
    }),
  );

  server.tool(
    'scout_policy_history',
    "Full version history for a scout's policy — most recent first. Use to audit which rule was active when an idea was filed, or to see what the scout-learner has previously proposed.",
    {
      scout_slug: z.string().min(1).max(100),
      limit: z.number().int().min(1).max(200).default(50),
    },
    withAudit(ctx, 'scout_policy_history', 'read:ideas', async ({ scout_slug, limit }) => {
      const rows = await getScoutPolicyHistory(scout_slug, limit);
      return jsonResult({ scout_slug, versions: rows });
    }),
  );

  server.tool(
    'scout_policy_propose',
    [
      "Propose a new policy version for a scout. Inserts as status='proposed' — never auto-activates. Jonathan reviews + activates via the admin UI.",
      '',
      'Use from the scout-learner profile only. Include `rationale` AND the 3 example idea ids (in the body or rationale) that motivated each rule — required for audit per the scout-learner card.',
      '',
      'Conventional `policy` shape (evolving): { dont_file_categories?: string[], prioritize?: string[], dedup_rules?: string[], notes?: string }. JSONB column accepts any shape — the scout prompt is responsible for knowing how to apply what the learner writes.',
    ].join('\n'),
    {
      scout_slug: z.string().min(1).max(100),
      policy: z.record(z.string(), z.unknown()),
      rationale: z.string().min(1).max(20000).optional(),
      proposed_by: z.string().min(1).max(100),
    },
    withAudit(
      ctx,
      'scout_policy_propose',
      'write:ideas',
      async ({ scout_slug, policy, rationale, proposed_by }) => {
        const row = await proposeScoutPolicy({
          scoutSlug: scout_slug,
          policy: policy as Record<string, unknown>,
          rationale: rationale ?? null,
          proposedBy: proposed_by,
          actor: {
            actorType: 'agent',
            actorName: ctx.actorName,
            keyId: ctx.keyId,
          },
        });
        return jsonResult({
          ok: true,
          id: row.id,
          scout_slug: row.scout_slug,
          version: row.version,
          status: row.status,
          url: `https://ops.heyhenry.io/admin/scout-policy/${row.id}`,
        });
      },
    ),
  );
}
