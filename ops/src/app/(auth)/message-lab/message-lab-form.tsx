'use client';

import { useState, useTransition } from 'react';
import type { EvalResult, MessageType } from '@/lib/message-lab/types';
import { runMessageEvalAction } from './actions';

const MESSAGE_TYPES: { value: MessageType; label: string }[] = [
  { value: 'ad', label: 'Ad' },
  { value: 'email', label: 'Email' },
  { value: 'landing_page', label: 'Landing page' },
  { value: 'sales_page', label: 'Sales page' },
  { value: 'sms', label: 'SMS' },
  { value: 'headline', label: 'Headline' },
  { value: 'social_post', label: 'Social post' },
  { value: 'other', label: 'Other' },
];

export function MessageLabForm() {
  const [copy, setCopy] = useState('');
  const [url, setUrl] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('ad');
  const [goal, setGoal] = useState('');
  const [result, setResult] = useState<EvalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await runMessageEvalAction({
        copy,
        url,
        message_type: messageType,
        goal,
      });
      if (res.ok) setResult(res.result);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border border-[var(--border)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">
            <span className="mr-2 text-[var(--muted-foreground)]">Type</span>
            <select
              value={messageType}
              onChange={(e) => setMessageType(e.target.value as MessageType)}
              className="rounded-md border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
            >
              {MESSAGE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Goal (optional) — e.g. get GCs to book a demo"
            className="flex-1 rounded-md border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm"
          />
        </div>

        <textarea
          value={copy}
          onChange={(e) => setCopy(e.target.value)}
          placeholder="Paste your copy here…"
          rows={8}
          className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm"
        />

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="…or a URL to fetch (used only if the box above is empty)"
            className="flex-1 rounded-md border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="rounded-md bg-[var(--foreground)] px-4 py-1.5 text-sm font-medium text-[var(--background)] disabled:opacity-50"
          >
            {pending ? 'Running panel…' : 'Run panel'}
          </button>
        </div>
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {pending ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Embodying the panel and collecting reactions — this takes ~10-30s.
          </p>
        ) : null}
      </div>

      {result ? <Results result={result} /> : null}
    </div>
  );
}

function Results({ result }: { result: EvalResult }) {
  const pct = Math.round(result.buy_ratio * 100);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-3xl font-semibold tracking-tight">
          {result.buy_count}/{result.total}
        </span>
        <span className="text-[var(--muted-foreground)]">would buy ({pct}%)</span>
        <span className="text-xs text-[var(--muted-foreground)]">
          {result.spent_cents.toFixed(1)}¢
        </span>
      </div>

      {result.objections.length > 0 ? (
        <div className="rounded-lg border border-[var(--border)] p-4">
          <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Objections to write against
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {result.objections.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-3">
        {result.verdicts.map((v) => (
          <div key={v.archetype_id} className="rounded-lg border border-[var(--border)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-base">{v.emoji}</span>
                <span className="font-medium">{v.name}</span>
                {v.attractiveness_rank ? (
                  <span className="text-xs text-[var(--muted-foreground)]">
                    #{v.attractiveness_rank} target
                  </span>
                ) : null}
                <span className="text-xs text-[var(--muted-foreground)]">{v.evidence_basis}</span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  v.decision === 'buy'
                    ? 'bg-emerald-500/15 text-emerald-600'
                    : 'bg-red-500/15 text-red-600'
                }`}
              >
                {v.decision === 'buy' ? 'Would buy' : "Wouldn't buy"}
              </span>
            </div>
            <p className="mt-2 text-sm">{v.reason}</p>
            {v.comments?.turns_off ? (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                <span className="font-medium">Turned off by:</span> {v.comments.turns_off}
              </p>
            ) : null}
            {v.comments?.would_make_buy ? (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                <span className="font-medium">Would act if:</span> {v.comments.would_make_buy}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
