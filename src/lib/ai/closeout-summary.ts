/**
 * ✦ Henry closeout summary — the one new Henry touchpoint on the Home
 * Record. Drafts a warm one-paragraph project narrative from the frozen
 * snapshot (scope, phases, notable selections + change orders) that lands
 * at the top of the public artifact.
 *
 * Operator-approved before it enters the record — Henry NEVER auto-sends
 * and the summary only becomes part of the snapshot once the operator
 * clicks "Keep". On the public artifact it renders as plain prose (no ✦,
 * Henry invisible client-side).
 *
 * CLIENT BOUNDARY: the prompt is fed ONLY client-safe snapshot fields —
 * never margin / markup / supplier cost / internal notes. Change-order
 * cost is the only money, in CAD.
 *
 * Returns null on any AI failure rather than throwing — the operator can
 * always write the summary by hand.
 */

import { gateway } from '@/lib/ai-gateway';
import type { PropertyRecordSnapshotV1 } from '@/lib/db/queries/property-records';

const CLOSEOUT_SUMMARY_SYSTEM_PROMPT = `You are Henry, an AI assistant writing on behalf of a residential renovation contractor. You're drafting the opening paragraph of a permanent "Property Record" — the closeout handoff document the client keeps forever.

Write ONE warm, plain-language paragraph (3-6 sentences) that a homeowner reads as the first thing on the document. It should:
- Tell the story of the project: what was done, the rooms/scope, a few notable materials or finishes by name.
- Mention how the phases went (e.g. ahead of plan, a delay and why) only if the data supports it.
- Note that change orders, if any, were approved by the client before work proceeded.
- Read as if the contractor wrote it: warm, proud-but-plain, "we" voice ("Over fourteen weeks we took your home…"). Speak TO the client ("your kitchen"), never about a generic homeowner.

Hard rules:
- NO prices, costs, margins, markups, supplier names, or SKUs. This is a warm narrative, not an invoice.
- NO trade jargon the client wouldn't know. NO marketing fluff or superlatives ("stunning", "dream").
- Don't invent facts. Only use what's in the provided project data. If the data is thin, write a short honest paragraph from what's there.
- Output ONLY the paragraph text. No heading, no markdown, no quotes around it.`;

const SUMMARY_MODEL = process.env.PHOTO_CLASSIFIER_MODEL ?? 'claude-haiku-4-5-20251001';

/**
 * Build the client-safe context block from the snapshot. Deliberately omits
 * supplier / SKU / cost-of-materials — the only money is approved CO cost
 * impact (CAD), which is already client-facing on the artifact.
 *
 * Exported for the client-boundary unit test — the prompt must never carry
 * margin / markup / supplier / SKU / allowance / actual-cost.
 */
export function buildCloseoutSummaryContext(snapshot: PropertyRecordSnapshotV1): string {
  const blocks: string[] = [];
  blocks.push(`Project: ${snapshot.project.name}`);
  if (snapshot.project.description) {
    blocks.push(`Scope (operator notes): ${snapshot.project.description}`);
  }
  if (snapshot.project.start_date || snapshot.project.target_end_date) {
    blocks.push(
      `Dates: started ${snapshot.project.start_date ?? 'n/a'}, target end ${snapshot.project.target_end_date ?? 'n/a'}`,
    );
  }
  if (snapshot.phases.length > 0) {
    blocks.push(`Phases:\n${snapshot.phases.map((p) => `- ${p.name} (${p.status})`).join('\n')}`);
  }
  if (snapshot.selections.length > 0) {
    // Brand + name + room only — no supplier, no SKU, no cost.
    const lines = snapshot.selections
      .slice(0, 20)
      .map((s) => {
        const what = [s.brand, s.name].filter(Boolean).join(' ');
        return `- ${s.room}: ${s.category}${what ? ` — ${what}` : ''}`;
      })
      .join('\n');
    blocks.push(`Notable selections (room · category · brand/name):\n${lines}`);
  }
  if (snapshot.change_orders.length > 0) {
    const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
    const lines = snapshot.change_orders
      .map(
        (co) =>
          `- ${co.title} (${cad.format((co.cost_impact_cents ?? 0) / 100)}${
            co.timeline_impact_days ? `, +${co.timeline_impact_days} days` : ''
          }) — approved`,
      )
      .join('\n');
    blocks.push(`Approved change orders (all approved by the client):\n${lines}`);
  }
  blocks.push('Write the opening paragraph for this Property Record.');
  return blocks.join('\n\n');
}

export async function draftCloseoutSummary(
  snapshot: PropertyRecordSnapshotV1,
): Promise<string | null> {
  // Need at least *some* substance — a bare project name yields a hollow
  // paragraph. Let the operator write it by hand in that case.
  const hasSubstance =
    Boolean(snapshot.project.description) ||
    snapshot.phases.length > 0 ||
    snapshot.selections.length > 0 ||
    snapshot.change_orders.length > 0;
  if (!hasSubstance) return null;

  try {
    const res = await gateway().runChat({
      kind: 'chat',
      task: 'closeout_summary',
      model_override: SUMMARY_MODEL,
      system: CLOSEOUT_SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildCloseoutSummaryContext(snapshot) }],
      max_tokens: 600,
    });
    const text = res.text
      .trim()
      .replace(/^["']|["']$/g, '')
      .trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
