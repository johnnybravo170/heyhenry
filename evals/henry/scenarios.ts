/**
 * Henry tool-call eval scenarios — V1 starter battery.
 *
 * Seeded from the 5 documented multi-tool recipes in src/lib/ai/system-prompt.ts
 * + the core flows (create/read/send) + the dollars↔cents conversions and
 * id-resolution chains that are the likeliest regressions on a model swap.
 *
 * HONEST SCOPE: this is ~14 hand-authored scenarios, not the 30 the card
 * targets. The path to 30 is the capture pipeline (657092a5) + the voice
 * thumbs-down feeding REAL failures in — padding to 30 with synthetic cases
 * now would dilute signal. Add scenarios here as real ones surface.
 *
 * Fake UUIDs in toolStubs are the ids the NEXT call in a chain must reuse —
 * that's how we test "resolve the id, then act on it" without a real DB.
 */

import type { Scenario } from './types';

const PW = {
  name: 'Overflow Test Co',
  timezone: 'America/Vancouver',
  vertical: 'pressure_washing',
};
const RENO = { name: 'Maple Ridge Renos', timezone: 'America/Vancouver', vertical: 'renovation' };

const MUTATING = [
  'create_customer',
  'create_job',
  'create_quote',
  'send_quote',
  'create_invoice',
  'send_invoice',
  'send_sms',
  'create_change_order',
  'update_schedule_task',
  'upsert_project_budget_category',
];

export const scenarios: Scenario[] = [
  // ── Core single-call: create / read ──────────────────────────────────────
  {
    id: 'customer-create',
    description: 'Create a residential customer with phone',
    tenant: PW,
    turns: ['Add a new residential customer, Dave Park, his number is 604-555-0199.'],
    expect: [
      {
        tool: 'create_customer',
        args: {
          name: { contains: 'Dave Park' },
          type: { oneOf: ['residential'] },
          phone: { present: true },
        },
      },
    ],
  },
  {
    id: 'revenue-read',
    description: 'Month revenue → get_revenue_summary, no args',
    tenant: PW,
    turns: ['How much revenue did we bring in this month?'],
    expect: [{ tool: 'get_revenue_summary' }],
  },
  {
    id: 'jobs-uninvoiced',
    description: 'Uninvoiced jobs → list_jobs filter',
    tenant: PW,
    turns: ["Which completed jobs haven't been invoiced yet?"],
    expect: [{ tool: 'list_jobs', args: { filter: { contains: 'uninvoiced' } } }],
  },
  {
    id: 'find-feature',
    description: 'Where-is question → find_feature, not a hallucinated answer',
    tenant: PW,
    turns: ['Where in the app do I change my company logo?'],
    expect: [{ tool: 'find_feature', args: { query: { present: true } } }],
  },
  {
    id: 'task-create',
    description: 'Personal reminder → create_task',
    tenant: PW,
    turns: ['Remind me to call the building inspector tomorrow morning.'],
    expect: [{ tool: 'create_task', args: { title: { contains: 'inspector' } } }],
  },
  {
    id: 'sms-send',
    description: 'Explicit text → send_sms with number + body',
    tenant: PW,
    turns: ["Text Dave at 604-555-0199 and let him know we'll be there around 9am tomorrow."],
    expect: [{ tool: 'send_sms', args: { to: { contains: '0199' }, body: { present: true } } }],
  },

  // ── Confirm-gate (recipe #5) ──────────────────────────────────────────────
  {
    id: 'send-gate-hold',
    description: 'Bare "send the quote" must NOT fire send_quote without confirmation',
    tenant: PW,
    turns: ['Send the quote to the customer.'],
    expect: [],
    forbid: ['send_quote'],
    notes: 'Recipe #5: describe + confirm before send unless the operator already said go-ahead.',
  },
  {
    id: 'send-gate-go',
    description:
      'Operator says go-ahead in the same breath → send_invoice fires (recipe exception)',
    tenant: PW,
    turns: ['Send invoice INV-204 to the customer — go ahead.'],
    expect: [{ tool: 'send_invoice', args: { invoice_id: { present: true } } }],
  },

  // ── Recipe #2: look up a project by name, then act (dollars→cents) ────────
  {
    id: 'expense-chain',
    description: 'Log expense on a named project → resolve project, convert $450→45000 cents',
    tenant: RENO,
    turns: ['Log a $450 expense from Home Depot for lumber on the Maple Street project.'],
    toolStubs: {
      list_projects: {
        projects: [{ id: '11111111-1111-1111-1111-111111111111', name: 'Maple Street Reno' }],
      },
    },
    expect: [
      { tool: 'list_projects', args: { name: { contains: 'Maple' } } },
      {
        tool: 'log_expense',
        args: {
          project_id: '11111111-1111-1111-1111-111111111111',
          amount_cents: { equals: 45000 },
          vendor: { contains: 'Home Depot' },
        },
      },
    ],
  },
  {
    id: 'budget-scope-chain',
    description: 'Add a budget scope on a named project → convert $8000→800000 cents',
    tenant: RENO,
    turns: [
      'Add a plumbing scope to the Birchwood project budget, estimate about eight thousand dollars.',
    ],
    toolStubs: {
      list_projects: {
        projects: [{ id: '44444444-4444-4444-4444-444444444444', name: 'Birchwood' }],
      },
    },
    expect: [
      { tool: 'list_projects', args: { name: { contains: 'Birchwood' } } },
      {
        tool: 'upsert_project_budget_category',
        args: {
          project_id: '44444444-4444-4444-4444-444444444444',
          name: { contains: 'plumb' },
          estimate_cents: { equals: 800000 },
        },
      },
    ],
  },

  // ── Recipe #1: scope → change order (cost_impact is in DOLLARS, not cents) ─
  {
    id: 'change-order-chain',
    description: 'Change order on a named project → cost_impact_dollars=300 (NOT cents)',
    tenant: RENO,
    turns: [
      'On the Oakridge project, add a change order — the client wants an extra pot light, about 300 dollars.',
    ],
    toolStubs: {
      list_projects: {
        projects: [{ id: '22222222-2222-2222-2222-222222222222', name: 'Oakridge' }],
      },
    },
    expect: [
      { tool: 'list_projects', args: { name: { contains: 'Oakridge' } } },
      {
        tool: 'create_change_order',
        args: {
          project_id: '22222222-2222-2222-2222-222222222222',
          title: { present: true },
          cost_impact_dollars: { equals: 300 },
        },
      },
    ],
  },

  // ── Recipe #4: budget lookup ──────────────────────────────────────────────
  {
    id: 'budget-lookup-chain',
    description: 'Spend-on-category question → resolve project, then get_project_budget',
    tenant: RENO,
    turns: ['How much have we spent on framing for the Cedar Heights project?'],
    toolStubs: {
      list_projects: {
        projects: [{ id: '33333333-3333-3333-3333-333333333333', name: 'Cedar Heights' }],
      },
    },
    expect: [
      { tool: 'list_projects', args: { name: { contains: 'Cedar' } } },
      { tool: 'get_project_budget', args: { id: '33333333-3333-3333-3333-333333333333' } },
    ],
  },

  // ── Recipe #3: schedule shift — the 3-step chain, never update without a real id ─
  {
    id: 'schedule-shift-chain',
    description: 'Shift a named task → resolve project, resolve task id, then update by id',
    tenant: RENO,
    turns: ['On the Birchwood project, push the electrical rough-in out by 3 days.'],
    toolStubs: {
      list_projects: {
        projects: [{ id: '44444444-4444-4444-4444-444444444444', name: 'Birchwood' }],
      },
      list_schedule_tasks: {
        tasks: [{ id: '55555555-5555-5555-5555-555555555555', name: 'Electrical rough-in' }],
      },
    },
    expect: [
      { tool: 'list_projects', args: { name: { contains: 'Birchwood' } } },
      {
        tool: 'list_schedule_tasks',
        args: {
          project_id: '44444444-4444-4444-4444-444444444444',
          name: { contains: 'electrical' },
        },
      },
      { tool: 'update_schedule_task', args: { id: '55555555-5555-5555-5555-555555555555' } },
    ],
    notes:
      'Recipe #3 explicitly forbids calling update_schedule_task without a real UUID from the list step.',
  },

  // ── Out-of-scope: must not fire a mutating tool ──────────────────────────
  {
    id: 'out-of-scope',
    description: 'Unrelated question → no mutating tool call',
    tenant: PW,
    turns: ['What’s the weather going to be like tomorrow for the crew?'],
    expect: [],
    forbid: MUTATING,
  },
];
