import { describe, expect, it } from 'vitest';
import { evaluate, matchArg } from '../../../evals/henry/assert';
import type { CapturedCall, Scenario } from '../../../evals/henry/types';

// Locks the eval GRADER. A bug here = wrong pass/fail verdicts on Henry model
// swaps, which is worse than no eval. The WS driver needs a live key to test;
// this pure logic does not.

function call(tool: string, args: Record<string, unknown> = {}): CapturedCall {
  return { tool, args, callId: `${tool}-id` };
}

describe('matchArg', () => {
  it('shorthand primitives are exact-equals', () => {
    expect(matchArg(45000, 45000)).toBe(true);
    expect(matchArg(45000, 450)).toBe(false);
    expect(matchArg('residential', 'residential')).toBe(true);
  });
  it('{equals} deep-compares', () => {
    expect(matchArg({ equals: 300 }, 300)).toBe(true);
    expect(matchArg({ equals: 300 }, 30000)).toBe(false);
  });
  it('{contains} is case-insensitive substring on strings only', () => {
    expect(matchArg({ contains: 'Maple' }, 'maple street reno')).toBe(true);
    expect(matchArg({ contains: 'Home Depot' }, 'HOME DEPOT')).toBe(true);
    expect(matchArg({ contains: 'x' }, 123)).toBe(false);
  });
  it('{present} requires a non-null value', () => {
    expect(matchArg({ present: true }, 'anything')).toBe(true);
    expect(matchArg({ present: true }, 0)).toBe(true);
    expect(matchArg({ present: true }, undefined)).toBe(false);
    expect(matchArg({ present: true }, null)).toBe(false);
  });
  it('{oneOf} matches any listed value', () => {
    expect(matchArg({ oneOf: ['residential', 'commercial'] }, 'residential')).toBe(true);
    expect(matchArg({ oneOf: ['residential'] }, 'agent')).toBe(false);
  });
});

const base: Omit<Scenario, 'expect'> = {
  id: 's',
  description: 'd',
  tenant: { name: 'T', timezone: 'America/Vancouver', vertical: 'renovation' },
  turns: ['x'],
};

describe('evaluate', () => {
  it('passes an exact single-call match', () => {
    const s: Scenario = { ...base, expect: [{ tool: 'get_revenue_summary' }] };
    expect(evaluate(s, [call('get_revenue_summary')]).pass).toBe(true);
  });

  it('fails on tool-name mismatch with a reason', () => {
    const s: Scenario = { ...base, expect: [{ tool: 'list_jobs' }] };
    const r = evaluate(s, [call('list_quotes')]);
    expect(r.pass).toBe(false);
    expect(r.reasons[0]).toContain('expected "list_jobs", got "list_quotes"');
  });

  it('fails on arg mismatch (dollars→cents regression)', () => {
    const s: Scenario = {
      ...base,
      expect: [{ tool: 'log_expense', args: { amount_cents: { equals: 45000 } } }],
    };
    expect(evaluate(s, [call('log_expense', { amount_cents: 450 })]).pass).toBe(false);
    expect(evaluate(s, [call('log_expense', { amount_cents: 45000 })]).pass).toBe(true);
  });

  it('fails on a missing expected call', () => {
    const s: Scenario = {
      ...base,
      expect: [{ tool: 'list_projects' }, { tool: 'get_project_budget' }],
    };
    const r = evaluate(s, [call('list_projects')]);
    expect(r.pass).toBe(false);
    expect(r.reasons.join(' ')).toContain('missing call #2');
  });

  it('passes a correct ordered chain and ignores extra trailing calls', () => {
    const s: Scenario = {
      ...base,
      expect: [
        { tool: 'list_projects', args: { name: { contains: 'cedar' } } },
        { tool: 'get_project_budget', args: { id: '33333333-3333-3333-3333-333333333333' } },
      ],
    };
    const captured = [
      call('list_projects', { name: 'Cedar' }),
      call('get_project_budget', { id: '33333333-3333-3333-3333-333333333333' }),
      call('get_dashboard'), // extra trailing → ignored
    ];
    expect(evaluate(s, captured).pass).toBe(true);
  });

  it('fails when a forbidden tool is called (confirm-gate)', () => {
    const s: Scenario = { ...base, expect: [], forbid: ['send_quote'] };
    expect(evaluate(s, [call('send_quote', { quote_id: 'q1' })]).pass).toBe(false);
    expect(evaluate(s, [call('list_quotes')]).pass).toBe(true); // a non-forbidden read is fine
  });

  it('passes out-of-scope when no tool fires at all', () => {
    const s: Scenario = { ...base, expect: [], forbid: ['create_job', 'send_sms'] };
    expect(evaluate(s, []).pass).toBe(true);
  });

  it('surfaces a harness/driver error as a failure', () => {
    const s: Scenario = { ...base, expect: [{ tool: 'get_revenue_summary' }] };
    const r = evaluate(s, [], 'timeout');
    expect(r.pass).toBe(false);
    expect(r.reasons.join(' ')).toContain('timeout');
  });
});
