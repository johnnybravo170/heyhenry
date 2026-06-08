/**
 * ✦ Henry estimate scope summary — drafts the client-facing scope narrative
 * shown under the headline total in lump-sum (and sections) mode on the
 * customer estimate. The operator edits + approves it before it's saved;
 * Henry NEVER auto-sends, and the prose renders plain client-side (no ✦).
 *
 * CLIENT BOUNDARY: lump-sum mode exists precisely to HIDE the cost
 * breakdown. So the prompt is fed ONLY the scope ("the what") — project
 * name/description + cost-line labels/notes grouped by customer-facing
 * section/category. It is NEVER fed unit prices, line totals, the
 * management-fee/markup, margin, supplier cost, or SKUs. Leaking any of
 * those would defeat the whole point of the mode and expose the operator's
 * pricing. The headline total is shown separately by the render; the
 * narrative stays money-free.
 *
 * Returns null on any AI failure (or too-thin input) rather than throwing —
 * the operator can always write the summary by hand.
 */

import { gateway } from '@/lib/ai-gateway';

/** Client-safe line shape — labels/notes/grouping only, never money. */
export type ScopeSummaryLine = {
  label: string;
  notes?: string | null;
  categoryName?: string | null;
  section?: string | null;
};

export type ScopeSummaryInput = {
  projectName: string;
  /** Operator's free-form project description, if any. */
  description?: string | null;
  lines: ScopeSummaryLine[];
};

const SCOPE_SUMMARY_SYSTEM_PROMPT = `You are Henry, an AI assistant writing on behalf of a contractor. You're drafting the scope summary a client reads on a fixed-price estimate where the line-item breakdown is intentionally hidden — they see one total and your paragraph.

Write ONE clear, plain-language paragraph (3-6 sentences) that tells the client what the job covers: the rooms/areas, the main work, and a few notable inclusions by name. Read as if the contractor wrote it: confident, plain, "we" voice, speaking TO the client ("your basement"), never about a generic customer.

Hard rules:
- NO prices, dollar figures, costs, line totals, markups, margins, management fees, supplier names, or SKUs. The client sees the total elsewhere — this paragraph is scope, not pricing.
- NO trade jargon the client wouldn't know. NO marketing fluff or superlatives ("stunning", "dream", "transform").
- Don't invent work. Only describe what's in the provided line items. If the data is thin, write a short honest paragraph from what's there.
- Output ONLY the paragraph text. No heading, no markdown, no quotes around it.`;

const SUMMARY_MODEL = process.env.PHOTO_CLASSIFIER_MODEL ?? 'claude-haiku-4-5-20251001';

/**
 * Build the client-safe context block. Groups line labels under their
 * section → category so the model can describe scope coherently, and
 * deliberately omits every money field. Exported for the client-boundary
 * unit test — the prompt must never carry price / total / markup / margin /
 * management fee / supplier / SKU.
 */
export function buildScopeSummaryContext(input: ScopeSummaryInput): string {
  const blocks: string[] = [];
  blocks.push(`Project: ${input.projectName}`);
  if (input.description?.trim()) {
    blocks.push(`Scope (operator notes): ${input.description.trim()}`);
  }

  // Group by section → category → line labels. No money anywhere.
  type Group = { section: string; category: string; labels: string[] };
  const groups = new Map<string, Group>();
  for (const l of input.lines) {
    const section = l.section?.trim() || 'Work';
    const category = l.categoryName?.trim() || 'Other';
    const key = `${section}␟${category}`;
    const g = groups.get(key) ?? { section, category, labels: [] };
    const label = [l.label?.trim(), l.notes?.trim()].filter(Boolean).join(' — ');
    if (label) g.labels.push(label);
    groups.set(key, g);
  }
  if (groups.size > 0) {
    const lines = Array.from(groups.values()).map((g) => {
      const items = g.labels.length > 0 ? g.labels.map((x) => `    • ${x}`).join('\n') : '    • —';
      return `- ${g.section} › ${g.category}\n${items}`;
    });
    blocks.push(`Scope items (section › category, no pricing):\n${lines.join('\n')}`);
  }

  blocks.push('Write the scope summary paragraph for this estimate.');
  return blocks.join('\n\n');
}

export async function draftScopeSummary(input: ScopeSummaryInput): Promise<string | null> {
  // Need some substance — a bare project name yields a hollow paragraph.
  const hasSubstance = Boolean(input.description?.trim()) || input.lines.length > 0;
  if (!hasSubstance) return null;

  try {
    const res = await gateway().runChat({
      kind: 'chat',
      task: 'estimate_scope_summary',
      model_override: SUMMARY_MODEL,
      system: SCOPE_SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildScopeSummaryContext(input) }],
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
