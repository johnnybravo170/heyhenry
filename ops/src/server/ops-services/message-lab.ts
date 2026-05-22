/**
 * Message Lab engine + CRUD. Pure functions over service-role Supabase,
 * same shape as board.ts.
 *
 * The engine is deliberately simpler than the board's discussion engine:
 * there are no cruxes and no inter-archetype debate. Each archetype
 * *embodies* a real customer and reacts to the copy independently, in
 * parallel. The score is the buy/no-buy split; the reasons are the
 * payload the calling writing agent acts on.
 */

import { callLlm, pickModel } from '@/lib/llm';
import {
  type Archetype,
  type ArchetypeVerdict,
  type ArchetypeWithDossier,
  type EvalResult,
  type MessageEval,
  type MessageEvalReaction,
  type MessageType,
  type ReactionOutput,
  reactionOutputSchema,
} from '@/lib/message-lab/types';
import { createServiceClient } from '@/lib/supabase';

type S = ReturnType<typeof createServiceClient>;
function svc(): S {
  return createServiceClient();
}

const REACTION_MAX_TOKENS = 1500;
const OBJECTION_MAX_TOKENS = 500;
// Each archetype reacts N times; the decision is a majority vote of the
// parsed samples. Kills single-sample noise and surfaces "wobblers".
const SAMPLES_PER_ARCHETYPE = 3;

// ── Archetypes ──────────────────────────────────────────────────────────

export async function listArchetypes(
  opts: { vertical?: string; include_retired?: boolean } = {},
): Promise<Archetype[]> {
  let q = svc()
    .schema('ops')
    .from('archetypes')
    .select('*')
    .order('sort_order', { ascending: true });
  if (opts.vertical) q = q.eq('vertical', opts.vertical);
  if (!opts.include_retired) q = q.eq('status', 'active');
  const { data, error } = await q;
  if (error) throw new Error(`listArchetypes: ${error.message}`);
  return (data ?? []) as Archetype[];
}

/** Hydrate archetypes with their dossier (knowledge_doc body) in one round-trip. */
export async function listArchetypesWithDossier(ids: string[]): Promise<ArchetypeWithDossier[]> {
  if (ids.length === 0) return [];
  const { data, error } = await svc()
    .schema('ops')
    .from('archetypes')
    .select('*, knowledge_docs:knowledge_id(body)')
    .in('id', ids);
  if (error) throw new Error(`listArchetypesWithDossier: ${error.message}`);
  type Row = Archetype & { knowledge_docs?: { body?: string } | null };
  return ((data ?? []) as Row[]).map((r) => ({
    ...r,
    dossier: r.knowledge_docs?.body ?? null,
  })) as ArchetypeWithDossier[];
}

// ── Evals (CRUD) ─────────────────────────────────────────────────────────

export type CreateEvalInput = {
  vertical: string;
  message_type: MessageType;
  goal: string;
  input_text: string;
  input_url?: string | null;
  archetype_ids: string[];
  budget_cents?: number;
  provider_override?: string | null;
  model_override?: string | null;
};

export async function createEval(
  input: CreateEvalInput,
  actor: { admin_user_id?: string | null; key_id?: string | null },
): Promise<MessageEval> {
  const row = {
    vertical: input.vertical,
    message_type: input.message_type,
    goal: input.goal,
    input_text: input.input_text,
    input_url: input.input_url ?? null,
    archetype_ids: input.archetype_ids,
    budget_cents: input.budget_cents ?? 50,
    provider_override: input.provider_override ?? null,
    model_override: input.model_override ?? null,
    created_by_admin_user_id: actor.admin_user_id ?? null,
    created_by_key_id: actor.key_id ?? null,
  };
  const { data, error } = await svc()
    .schema('ops')
    .from('message_evals')
    .insert(row)
    .select('*')
    .single();
  if (error || !data) throw new Error(`createEval: ${error?.message ?? 'no data'}`);
  return data as MessageEval;
}

export async function getEval(id: string): Promise<MessageEval | null> {
  const { data, error } = await svc()
    .schema('ops')
    .from('message_evals')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getEval: ${error.message}`);
  return (data ?? null) as MessageEval | null;
}

export async function listEvals(limit = 50): Promise<MessageEval[]> {
  const { data, error } = await svc()
    .schema('ops')
    .from('message_evals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listEvals: ${error.message}`);
  return (data ?? []) as MessageEval[];
}

async function updateEval(id: string, patch: Partial<MessageEval>): Promise<void> {
  const { id: _drop, created_at: _c, ...rest } = patch;
  void _drop;
  void _c;
  const { error } = await svc().schema('ops').from('message_evals').update(rest).eq('id', id);
  if (error) throw new Error(`updateEval: ${error.message}`);
}

export async function listReactions(eval_id: string): Promise<MessageEvalReaction[]> {
  const { data, error } = await svc()
    .schema('ops')
    .from('message_eval_reactions')
    .select('*')
    .eq('eval_id', eval_id);
  if (error) throw new Error(`listReactions: ${error.message}`);
  return (data ?? []) as MessageEvalReaction[];
}

// ── URL ingest ───────────────────────────────────────────────────────────

/** Fetch a URL and strip it to readable text. Intentionally dependency-free
 *  for v1 — drops script/style, unwraps tags, collapses whitespace. */
export async function fetchAndExtract(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'user-agent': 'HeyHenry-MessageLab/1.0' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`fetch ${url}: HTTP ${res.status}`);
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) throw new Error(`fetch ${url}: no extractable text`);
  // Cap so a giant page can't blow the prompt budget.
  return text.length > 12_000 ? `${text.slice(0, 12_000)}…` : text;
}

// ── Engine ───────────────────────────────────────────────────────────────

const MESSAGE_TYPE_LENS: Record<MessageType, string> = {
  ad: 'a paid ad you scrolled past in your feed — you give it about 3 seconds before deciding to ignore it or stop',
  email: 'an email that landed in your inbox from a company',
  landing_page: 'a landing page you arrived at after clicking something',
  sales_page: 'a long sales page for a product',
  sms: 'a text message from a company',
  headline: 'a headline, on its own',
  social_post: 'a social media post in your feed',
  other: 'a piece of marketing from a company',
};

function buildReactionSystem(a: ArchetypeWithDossier): Array<{ text: string; cache?: boolean }> {
  return [
    {
      text: `You are a real prospective customer, NOT a marketer or copywriter. You are reacting to marketing the way you actually would in real life — skeptical, busy, self-interested. Do not give generic advice about advertising or copywriting. React only from your own desires, fears, frustrations, and goals.`,
    },
    {
      text: `## Who you are\nYou are ${a.emoji} ${a.name} — "${a.tagline}". Embody this person fully; become them.`,
    },
    {
      text: `## How to decide (read carefully)\nMost contractors do NOT buy software — "no" is the common, default, expected answer, and a no_buy is exactly as useful to this study as a buy. You are not here to be agreeable or to help the company; you are protecting your own time and money. Hold the exact skepticism, objections, and trust requirements described in YOUR profile above. Only choose 'buy' if this specific copy genuinely overcomes the specific objections you carry AND you would realistically take the next step within the next week. If even one of your core objections is left unaddressed, or anything reads as hype, vaporware, or pressure, choose 'no_buy'. Do not give it the benefit of the doubt.`,
    },
    ...(a.dossier ? [{ text: `## Your full profile\n${a.dossier}`, cache: true as const }] : []),
  ];
}

function buildReactionUser(copy: string, message_type: MessageType, goal: string): string {
  const lens = MESSAGE_TYPE_LENS[message_type];
  return [
    `You are part of a panel of prospects reviewing marketing as a focus group. What follows is ${lens}.`,
    goal ? `Context on what the company is trying to achieve: ${goal}` : '',
    `Read it as yourself and answer honestly:`,
    `- Does it relate to you? Does it speak to your actual situation?`,
    `- What about it appeals to you?`,
    `- What about it turns you off or makes you not trust it?`,
    `- What would it have to say to make you act now?`,
    `- Final call: would you buy / take the next step? A simple yes or no, and WHY.`,
    ``,
    `Return ONLY JSON in this shape:`,
    JSON.stringify(
      {
        decision: "'buy' or 'no_buy'",
        reason: 'one or two sentences — the core reason for your yes/no',
        relates: 'does it relate to you?',
        appeals: 'what appeals',
        turns_off: 'what turns you off / erodes trust',
        would_make_buy: 'what would make you act now',
      },
      null,
      2,
    ),
    ``,
    `## The marketing piece\n${copy}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** One reaction sample. Parses or throws. */
async function reactOnce(
  a: ArchetypeWithDossier,
  copy: string,
  message_type: MessageType,
  goal: string,
  choice: ReturnType<typeof pickModel>,
): Promise<{
  parsed: ReactionOutput;
  raw: string;
  cost_cents: number;
  provider: string;
  model: string;
}> {
  const res = await callLlm(choice, {
    task: 'ops:message-lab',
    system: buildReactionSystem(a),
    messages: [{ role: 'user', content: buildReactionUser(copy, message_type, goal) }],
    temperature: 0.7,
    max_tokens: REACTION_MAX_TOKENS,
    json: true,
  });
  return {
    parsed: parseReaction(res.text),
    raw: res.text,
    cost_cents: res.cost_cents,
    provider: res.provider,
    model: res.model,
  };
}

type SampledArchetype = {
  verdict: ArchetypeVerdict;
  cost: number;
  raw: string | null;
  provider: string | null;
  model: string | null;
};

/** Sample one archetype N times and majority-vote the decision. Parse/call
 *  failures are dropped from the denominator (NOT counted as no_buy), so a
 *  flaky model run doesn't bias the verdict. Tie or zero parsed → no_buy
 *  (conservative — the burden is on the copy to win a clear majority). */
async function sampleArchetype(
  a: ArchetypeWithDossier,
  copy: string,
  message_type: MessageType,
  goal: string,
  choice: ReturnType<typeof pickModel>,
): Promise<SampledArchetype> {
  const settled = await Promise.allSettled(
    Array.from({ length: SAMPLES_PER_ARCHETYPE }, () =>
      reactOnce(a, copy, message_type, goal, choice),
    ),
  );

  let cost = 0;
  let provider: string | null = null;
  let model: string | null = null;
  const parsed: Array<{ r: ReactionOutput; raw: string }> = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') {
      cost += s.value.cost_cents;
      provider = s.value.provider;
      model = s.value.model;
      parsed.push({ r: s.value.parsed, raw: s.value.raw });
    }
  }

  const sample_count = parsed.length;
  const buy_votes = parsed.filter((p) => p.r.decision === 'buy').length;
  const decision: 'buy' | 'no_buy' =
    sample_count > 0 && buy_votes * 2 > sample_count ? 'buy' : 'no_buy';

  // Representative reaction: a parsed sample that matches the majority verdict
  // (so the surfaced reason agrees with the vote), else the first parsed one,
  // else a stub when every sample failed to parse.
  const repHit = parsed.find((p) => p.r.decision === decision) ?? parsed[0];
  const rep: ReactionOutput = repHit?.r ?? {
    decision,
    reason: '(no reaction parsed across samples)',
    relates: '',
    appeals: '',
    turns_off: '',
    would_make_buy: '',
  };

  return {
    verdict: {
      archetype_id: a.id,
      slug: a.slug,
      name: a.name,
      emoji: a.emoji,
      evidence_basis: a.evidence_basis,
      attractiveness_rank: a.attractiveness_rank,
      decision,
      buy_votes,
      sample_count,
      reason: rep.reason,
      comments: {
        relates: rep.relates,
        appeals: rep.appeals,
        turns_off: rep.turns_off,
        would_make_buy: rep.would_make_buy,
      },
    },
    cost,
    raw: repHit?.raw ?? null,
    provider,
    model,
  };
}

/** Run the full panel synchronously and return the aggregate result. Each
 *  archetype is sampled N times in parallel and majority-voted; the headline
 *  is the count of archetypes that LEAN buy. Treat that count as a
 *  comparative signal across drafts on the same panel — NOT a conversion
 *  forecast (LLM panels skew agreeable; the trustworthy output is the
 *  per-archetype reasons + collated objections). */
export async function runEval(eval_id: string): Promise<EvalResult> {
  const ev = await getEval(eval_id);
  if (!ev) throw new Error(`eval ${eval_id} not found`);
  if (ev.status !== 'pending') throw new Error(`eval ${eval_id} is ${ev.status}, must be pending`);

  await updateEval(eval_id, { status: 'running' });

  try {
    const archetypes = await listArchetypesWithDossier(ev.archetype_ids);
    if (archetypes.length === 0) throw new Error('no archetypes resolved for this eval');

    const copy = ev.input_text ?? '';
    if (!copy.trim()) throw new Error('eval has no input copy');

    const choice = pickModel('archetype_reaction', {
      provider: ev.provider_override,
      model: ev.model_override,
    });

    const sampled = await Promise.all(
      archetypes.map((a) => sampleArchetype(a, copy, ev.message_type, ev.goal, choice)),
    );

    let spent = 0;
    const verdicts: ArchetypeVerdict[] = [];
    for (let i = 0; i < sampled.length; i++) {
      const s = sampled[i];
      const a = archetypes[i];
      spent += s.cost;
      await svc()
        .schema('ops')
        .from('message_eval_reactions')
        .insert({
          eval_id,
          archetype_id: a.id,
          decision: s.verdict.decision,
          reason: s.verdict.reason,
          comments: s.verdict.comments,
          sample_count: s.verdict.sample_count,
          buy_votes: s.verdict.buy_votes,
          raw_text: s.raw,
          provider: s.provider,
          model: s.model,
          cost_cents: Math.round(s.cost * 100) / 100,
        });
      verdicts.push(s.verdict);
    }

    const buy_count = verdicts.filter((v) => v.decision === 'buy').length;
    const no_buy_count = verdicts.length - buy_count;

    const objections = await collateObjections(
      verdicts.filter((v) => v.decision === 'no_buy'),
      choice,
    ).catch(() => verdicts.filter((v) => v.decision === 'no_buy').map((v) => v.reason));

    await updateEval(eval_id, {
      status: 'done',
      buy_count,
      no_buy_count,
      objections,
      spent_cents: Math.round(spent * 100) / 100,
      completed_at: new Date().toISOString(),
    });

    return {
      eval_id,
      status: 'done',
      message_type: ev.message_type,
      buy_count,
      no_buy_count,
      total: verdicts.length,
      buy_ratio: verdicts.length ? buy_count / verdicts.length : 0,
      verdicts: verdicts.sort(
        (a, b) => (a.attractiveness_rank ?? 99) - (b.attractiveness_rank ?? 99),
      ),
      objections,
      spent_cents: Math.round(spent * 100) / 100,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateEval(eval_id, { status: 'failed', error_message: message });
    throw err;
  }
}

/** Convenience: create + run in one call (the synchronous path the MCP tool
 *  and UI use). */
export async function runMessageEval(
  input: CreateEvalInput,
  actor: { admin_user_id?: string | null; key_id?: string | null },
): Promise<EvalResult> {
  const ev = await createEval(input, actor);
  return runEval(ev.id);
}

/** Theme the no_buy reasons into a short punch list for the writing agent.
 *  One cheap call; caller falls back to raw reasons on failure. */
async function collateObjections(
  noBuys: ArchetypeVerdict[],
  choice: ReturnType<typeof pickModel>,
): Promise<string[]> {
  if (noBuys.length === 0) return [];
  const blob = noBuys
    .map(
      (v) =>
        `- ${v.name}: ${v.reason}${v.comments?.turns_off ? ` | turned off by: ${v.comments.turns_off}` : ''}`,
    )
    .join('\n');
  const res = await callLlm(choice, {
    task: 'ops:message-lab:objections',
    system: [
      {
        text: 'You distill focus-group feedback into a tight, deduplicated list of distinct objections a copywriter can act on. No preamble.',
      },
    ],
    messages: [
      {
        role: 'user',
        content: `These prospects did NOT buy. Collapse their reasons into 3-6 distinct objections, most common first. Return ONLY a JSON array of short strings.\n\n${blob}`,
      },
    ],
    temperature: 0.3,
    max_tokens: OBJECTION_MAX_TOKENS,
    json: true,
  });
  const arr = JSON.parse(extractJson(res.text, '['));
  if (!Array.isArray(arr)) throw new Error('objections: not an array');
  return arr.map((x) => String(x)).slice(0, 8);
}

// ── JSON helpers ─────────────────────────────────────────────────────────

function parseReaction(text: string): ReactionOutput {
  return reactionOutputSchema.parse(JSON.parse(extractJson(text, '{')));
}

/** Pull the first balanced JSON value (object or array) out of model text,
 *  tolerating ```json fences and leading prose. */
function extractJson(text: string, open: '{' | '['): string {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const close = open === '{' ? '}' : ']';
  const start = s.indexOf(open);
  if (start < 0) throw new Error(`no JSON ${open} found in: ${text.slice(0, 300)}`);
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced JSON in: ${text.slice(0, 300)}`);
}
