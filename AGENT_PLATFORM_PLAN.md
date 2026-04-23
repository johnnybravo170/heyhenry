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

## Phase 2 — Runtime: Routines + Managed Agents (mix)

Decided 2026-04-22. Each agent ships as either a **Claude Code Routine** (cloud-hosted, Max-plan quota) or a **Managed Agent** call from app code (api.anthropic.com, per-token billing). Pick per-agent based on cadence and trigger model.

**Connecting layer is the same for both:** the OAuth-protected MCP endpoint at `https://ops.heyhenry.io/api/mcp`. One auth setup, two consumption modes.

### Routines — for scheduled / webhook background work
- Cloud-hosted on Anthropic infra → survives Mac mini power-out / network drop
- Triggers: schedule, per-routine HTTPS endpoint, GitHub webhook
- Free under Max plan (15 runs/day cap)
- Authoring: web UI at claude.ai/code/routines
- Best for: predictable cadence, set-and-forget

### Managed Agents — for app-triggered, sync, or bursty work
- Called from our code via Anthropic API (api.anthropic.com)
- No daily cap — billed per token
- Synchronous: caller gets the result back
- Best for: in-request-path AI features, incident bursts, anything that might fire 50× in a bad hour

### Per-agent runtime assignment

| Agent | Runtime | Why |
|---|---|---|
| doc-writer | Routine (GitHub webhook or daily) | Predictable, daily, free |
| competitive-research | Routine (daily) | Free, daily |
| customer-pulse | Routine (weekly) | Free, weekly |
| security-probe | Routine (daily) | Free, daily |
| weekly-dispatcher | Routine (Sun 6am) | Classic schedule |
| social/blog drafter | Routine (daily) | Free, daily |
| visual-QA | Routine (frequent) or Managed Agent on Playwright failure | Either; Routine if cadence-bounded |
| **incident-triage → SMS escalate** | **Managed Agent** | Volume unpredictable; SMS path needs sync; pay-per-incident is fine |
| **CI babysitter (on every push)** | **Managed Agent** | Could fire 10×/day on heavy coding days, blowing Routines cap |
| **inbound-lead triage (on Resend webhook)** | **Managed Agent** | App-initiated, sync, low-volume-but-bursty |

### Why this mix is right
- Routines cover ~70% of the workload at zero marginal cost
- Managed Agents handle the 30% where Routines' cap or sync model would break
- Worst case: a bad day burns ~$5 of Managed Agent tokens instead of bricking the agent fleet for the day

### MCP connector setup applies to both
- Routine: add HeyHenry Ops as a custom connector, OAuth flow once
- Managed Agent: pass MCP server config in the API call (`mcp_servers` param), OAuth tokens managed by your code or pre-provisioned

## Phase 3 — Admin UI

- Review-queue page: tabbed view of the four stacks (drafts / incidents / stale competitors / recent docs)
- Per-module list + detail pages mirroring the existing roadmap/ideas UI
- Inline approve/reject for social drafts (transition `draft → approved` / `rejected`)
- Inline assign + status change for incidents

## Out of scope (deliberately deferred)

- Per-incident SMS opt-out (Phase 0 always pages Jonathan; he's the only escalation target)
- Webhook ingestion (e.g. Sentry → `incidents`) — that's a Phase 3 connector, separate from the storage layer
- Embedding / semantic search across these new tables (only `knowledge_docs` has it today)
