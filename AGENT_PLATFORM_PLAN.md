# Agent Platform — HeyHenry Ops

A place for background agents to write down what they learn, what they're working on, and what needs Jonathan's attention. Lives inside `ops/` (the existing ops admin Next.js app), reuses the same HMAC API-key auth, audit log, and `ops` Supabase schema.

## Phase 0 — Storage + API (DONE)

Five new ops modules, all behind `/api/ops/*` with HMAC auth and per-scope keys. No admin UI yet — agents POST/GET via the API, Jonathan reads via Supabase or future UI.

| Module | Tables | Routes | Scopes |
|---|---|---|---|
| **competitors** | `ops.competitors` (unique on `name`, upserts) | `POST/GET /api/ops/competitors`, `GET/PATCH /api/ops/competitors/[id]` | `read:competitors`, `write:competitors` |
| **incidents** | `ops.incidents` (helpdesk queue: source × severity × status) | `POST/GET /api/ops/incidents`, `GET/PATCH /api/ops/incidents/[id]` | `read:incidents`, `write:incidents` |
| **social_drafts** | `ops.social_drafts` | `POST/GET /api/ops/social-drafts`, `GET/PATCH /api/ops/social-drafts/[id]` | `read:social`, `write:social` |
| **docs** | `ops.docs` (unique on `commit_range`, upserts) | `POST/GET /api/ops/docs`, `GET/PATCH /api/ops/docs/[id]` | `read:docs`, `write:docs` |
| **review_queue** | (read-only aggregator, no table) | `GET /api/ops/review-queue` | `read:review_queue` |
| **escalate-sms** | (writes `incidents.sms_escalated_at`) | `POST /api/ops/escalate-sms` | `write:escalate` |

Migration: `supabase/migrations/0084_ops_agent_platform.sql`. RLS enabled on every table, service-role-only access.

### Env vars

New env required for the SMS escalation route:

- `OPS_ESCALATION_PHONE` — Jonathan's mobile in E.164 (e.g. `+15551234567`). Without it, `/api/ops/escalate-sms` returns 500.

Reuses existing main-app envs: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_DEFAULT` (or `TWILIO_FROM_US`).

## Phase 1 — `mcp-ops` package (NEXT)

A standalone MCP server that wraps every Phase 0 endpoint as a tool. So an agent (Claude Code, etc.) can call `competitors.upsert`, `incidents.open`, `social_drafts.create`, `docs.write`, `review_queue.fetch`, `escalate.sms` directly without re-implementing HMAC signing per agent.

- Lives in `mcp/ops` (sibling to the existing `mcp/` packages)
- Reads `OPS_API_KEY` env (`ops_<id>_<secret>` format)
- Handles HMAC signing + timestamp headers internally
- Tool descriptions written for agent discoverability ("when you find a new competitor, call this; when a flaky test fires, call that")

## Phase 2 — Routines as the runtime

Decided 2026-04-22 (after a Claude Code Routines doc-check): each agent ships as a **Claude Code Routine**, not a local cron or Vercel function.

**Why Routines over alternatives:**
- Cloud-hosted on Anthropic infra → survives Mac mini power-out / OS update / network drop
- Three trigger types built in: schedule, per-routine HTTPS endpoint with bearer token, GitHub webhook
- Counts against Max-plan daily quota (15 runs/day) instead of API billing
- Each routine = saved prompt + scoped repos + MCP connectors → `mcp-ops` plugs in directly

**Per-agent routine setup pattern:**
- Prompt: self-contained instructions ("you are the competitive-research agent…")
- Connectors: `mcp-ops` (always), plus task-specific (e.g. web search for research agents)
- Env: that agent's `OPS_API_KEY` (scoped — competitive-research key cannot write to roadmap)
- Trigger: schedule (most), HTTPS POST (incident triage, CI babysitter), GitHub webhook (doc-writer)

**Quota math (Max = 15 runs/day):**
- Daily scheduled (1/day each): competitive-research, customer-pulse, security-probe, weekly-digest = ~4–5
- Event-driven (variable): incident-triage, CI-babysitter, doc-writer
- Mitigation if cap hit: batch CI-babysitter (every 2h instead of per-push) and doc-writer (daily commit-range instead of per-push)

## Phase 3 — Admin UI

- Review-queue page: tabbed view of the four stacks (drafts / incidents / stale competitors / recent docs)
- Per-module list + detail pages mirroring the existing roadmap/ideas UI
- Inline approve/reject for social drafts (transition `draft → approved` / `rejected`)
- Inline assign + status change for incidents

## Out of scope (deliberately deferred)

- Per-incident SMS opt-out (Phase 0 always pages Jonathan; he's the only escalation target)
- Webhook ingestion (e.g. Sentry → `incidents`) — that's a Phase 3 connector, separate from the storage layer
- Embedding / semantic search across these new tables (only `knowledge_docs` has it today)
