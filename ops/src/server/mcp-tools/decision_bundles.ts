import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase';
import { getDecisionReportCard } from '@/server/ops-services/decision-report-card';
import { jsonResult, type McpToolCtx, withAudit } from './context';

const BUCKETS = ['decision', 'research', 'go_nogo', 'grooming', 'visual'] as const;

export function registerDecisionBundleTools(server: McpServer, ctx: McpToolCtx) {
  server.tool(
    'decision_bundles_list',
    [
      'List Command Center queue bundles (the /admin/queue backing store).',
      'Use to dedup before drafting (is this card/idea already queued?) and to',
      'find parked bundles whose resurface_trigger now matches the current stage.',
      "Defaults to status='open'.",
    ].join('\n'),
    {
      status: z.enum(['open', 'resolved', 'parked', 'archived']).default('open'),
      bucket: z.enum(BUCKETS).optional(),
      resurface_trigger: z.string().max(100).optional(),
      limit: z.number().int().min(1).max(500).default(200),
    },
    withAudit(
      ctx,
      'decision_bundles_list',
      'read:decision_bundles',
      async ({ status, bucket, resurface_trigger, limit }) => {
        const service = createServiceClient();
        let q = service
          .schema('ops')
          .from('decision_bundles')
          .select(
            'id, dedup_key, card_id, related_type, bucket, question, options, recommendation, why_today, links, status, resurface_trigger, choice, rating, decision_id, before_image_url, after_image_url, image_caption, surfaced_at, resolved_at',
          )
          .eq('status', status)
          .order('surfaced_at', { ascending: false })
          .limit(limit);
        if (bucket) q = q.eq('bucket', bucket);
        if (resurface_trigger) q = q.eq('resurface_trigger', resurface_trigger);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return jsonResult({ bundles: data ?? [] });
      },
    ),
  );

  server.tool(
    'decision_bundles_upsert',
    [
      'Draft (or update) ONE Command Center queue item — your best thinking on a',
      'thing that needs judgment, surfaced at /admin/queue for Jonathan to resolve.',
      'READ + DRAFT only: never resolve on his behalf.',
      '',
      'Idempotent on `dedup_key` (use card:<uuid> | idea:<uuid> | theme:<slug>):',
      '  • settled bundles (resolved/archived) are left untouched — never resurrect a',
      '    decision Jonathan already made.',
      '  • open/parked bundles are updated in place.',
      '',
      'bucket: decision | research | go_nogo | grooming | visual.',
      'options (decision/go_nogo): [{ key, label, blast_radius?, unblocks?, recommended? }].',
      'Mark the option matching your recommendation recommended:true (light-shaded in the queue).',
      'Set status=parked + resurface_trigger for good-but-premature research.',
      'Visual-QA findings: bucket=visual + before_image_url (+ after_image_url) +',
      'image_caption (caption the pixels, plain English). Renders as an image card.',
    ].join('\n'),
    {
      dedup_key: z.string().min(1).max(200),
      bucket: z.enum(BUCKETS),
      question: z.string().min(1).max(2000),
      recommendation: z.string().max(20000).optional().nullable(),
      why_today: z.string().max(2000).optional().nullable(),
      options: z.array(z.record(z.string(), z.unknown())).max(10).optional().nullable(),
      links: z.array(z.record(z.string(), z.unknown())).max(20).optional().nullable(),
      card_id: z.string().uuid().optional().nullable(),
      related_type: z.enum(['kanban', 'idea']).optional().nullable(),
      status: z.enum(['open', 'parked']).default('open'),
      resurface_trigger: z.string().max(100).optional().nullable(),
      before_image_url: z.string().url().max(2000).optional().nullable(),
      after_image_url: z.string().url().max(2000).optional().nullable(),
      image_caption: z.string().max(2000).optional().nullable(),
    },
    withAudit(ctx, 'decision_bundles_upsert', 'write:decision_bundles', async (input) => {
      const service = createServiceClient();

      // Dedup on the SOURCE identity, not the free-form dedup_key string. The
      // routine has formed the key inconsistently for the same card (short id
      // vs full uuid vs ops:<slug>), which slipped past the old exact-string
      // guard and re-dumped the item every run. When there's a card_id we
      // canonicalize the key to `card:<uuid>` and match on card_id, so the
      // same card can't appear twice however the caller spelled the key.
      const canonicalKey = input.card_id ? `card:${input.card_id}` : input.dedup_key;

      const fields = {
        bucket: input.bucket,
        question: input.question,
        recommendation: input.recommendation ?? null,
        why_today: input.why_today ?? null,
        options: input.options ?? null,
        links: input.links ?? null,
        card_id: input.card_id ?? null,
        related_type: input.related_type ?? null,
        status: input.status,
        resurface_trigger: input.resurface_trigger ?? null,
        before_image_url: input.before_image_url ?? null,
        after_image_url: input.after_image_url ?? null,
        image_caption: input.image_caption ?? null,
        dedup_key: canonicalKey,
      };

      const matchQuery = service.schema('ops').from('decision_bundles').select('id, status');
      const { data: matches } = input.card_id
        ? await matchQuery.eq('card_id', input.card_id)
        : await matchQuery.eq('dedup_key', canonicalKey);

      const rows = matches ?? [];
      const liveMatch = rows.find((r) => r.status === 'open' || r.status === 'parked');
      const settledMatch = rows.find((r) => r.status === 'resolved' || r.status === 'archived');

      // Never resurrect a decision Jonathan already settled.
      if (!liveMatch && settledMatch) {
        return jsonResult({ ok: true, id: settledMatch.id, skipped: 'already settled' });
      }

      if (liveMatch) {
        const { data, error } = await service
          .schema('ops')
          .from('decision_bundles')
          .update(fields)
          .eq('id', liveMatch.id)
          .select('id')
          .single();
        if (error || !data) throw new Error(error?.message ?? 'Update failed');
        return jsonResult({
          ok: true,
          id: data.id,
          updated: true,
          url: 'https://ops.heyhenry.io/admin/queue',
        });
      }

      const { data, error } = await service
        .schema('ops')
        .from('decision_bundles')
        .insert({
          actor_type: 'agent',
          actor_name: ctx.actorName,
          key_id: ctx.keyId,
          ...fields,
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'Insert failed');
      return jsonResult({
        ok: true,
        id: data.id,
        created: true,
        url: 'https://ops.heyhenry.io/admin/queue',
      });
    }),
  );

  server.tool(
    'decision_bundles_report_card',
    [
      'Calibration signal for the Command Center (Step 8). Per bucket over a',
      'trailing window: acted (resolved) vs dismissed (archived) vs parked, the',
      'act_rate (acted / decided), and the mean recommendation rating.',
      'Use it to STOP surfacing classes Jonathan keeps dismissing and to judge',
      'which scouts earn their keep (low act_rate / low rating = prune).',
    ].join('\n'),
    {
      days: z.number().int().min(1).max(365).default(60),
    },
    withAudit(ctx, 'decision_bundles_report_card', 'read:decision_bundles', async ({ days }) => {
      const service = createServiceClient();
      return jsonResult(await getDecisionReportCard(service, days));
    }),
  );
}
