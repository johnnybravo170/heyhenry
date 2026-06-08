'use server';

import { z } from 'zod';
import { type EvalResult, messageTypeSchema } from '@/lib/message-lab/types';
import { requireAdmin } from '@/lib/ops-gate';
import { fetchAndExtract, listArchetypes, runMessageEval } from '@/server/ops-services/message-lab';

type ActionResult<T extends Record<string, unknown> = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const runSchema = z.object({
  copy: z.string().trim().max(40_000).default(''),
  url: z.string().trim().url().max(2000).optional().or(z.literal('')),
  message_type: messageTypeSchema.default('other'),
  goal: z.string().trim().max(2000).default(''),
  vertical: z.string().trim().max(64).default('general_contractor'),
});

export async function runMessageEvalAction(
  input: z.input<typeof runSchema>,
): Promise<ActionResult<{ result: EvalResult }>> {
  const admin = await requireAdmin();
  const parsed = runSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }
  const { copy, url, message_type, goal, vertical } = parsed.data;

  try {
    // Resolve the input copy: pasted text wins; otherwise fetch the URL.
    let input_text = copy;
    let input_url: string | null = null;
    if (!input_text && url) {
      input_text = await fetchAndExtract(url);
      input_url = url;
    }
    if (!input_text.trim()) {
      return { ok: false, error: 'Provide copy to test, or a URL to fetch.' };
    }

    const ids = (await listArchetypes({ vertical })).map((a) => a.id);
    if (ids.length === 0) {
      return { ok: false, error: `No active archetypes for '${vertical}'. Seed the panel first.` };
    }

    const result = await runMessageEval(
      { vertical, message_type, goal, input_text, input_url, archetype_ids: ids },
      { admin_user_id: admin.userId, key_id: null },
    );
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'failed' };
  }
}
