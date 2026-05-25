# ROUTINES — Claude Code Routine prompts

Source of truth for the prompts running as Claude Code Routines at `claude.ai/code/routines`. Each markdown file here is paste-ready for the Routine "Instructions" field.

## Fleet — HeyHenry routines

All are Remote (Anthropic cloud sandbox). Other Local routines visible in claude.ai/code/routines (`Friday memory synthesis`, `Heyhenry feature matrix refresh`) belong to **HenryOS**, not HeyHenry, and are out of scope for this registry.

## Command Center + collector model (2026-05-25)

The **HeyHenry Command Center** (`daily-board-triage.md`) is the single weekday morning triage and the **sole synthesizer**. The research/idea scouts are now **collectors**: they keep doing their domain collection and write raw signal to their existing surface (the ideas pool), but they **no longer email Jonathan or build per-scout digests / report-cards addressed to him** — each scout file carries a `⚠ COLLECTOR MODE` banner that suspends those steps. The Command Center dedups across scouts, applies the why-now gate, and sends the ONE daily digest → `/admin/queue`. `weekly-dispatcher` is **retired** (its narrative roll-up folds into the Command Center).

**When you reconcile drift, the banner wins** — the email/digest steps still physically exist below each banner for reference, but COLLECTOR MODE suspends them.

## Boundary: business-scout vs marketing-strategist

Both routines write to `ops.ideas` (as collectors). Hard separation by category:

- **business-scout** owns: `revenue`, `retention`, `market-expansion`, `pricing`, `positioning`, `partnership`, `ops-efficiency`. Strategic moves with hard testability gates and ≥ 3 ops-surface citation requirement. Tagged `biz-scout`.
- **marketing-strategist** owns: `content`, `launch`, `acquisition`. Tactical marketing brainstorms framed around named contractor archetypes (Will, JVD, John). Tagged `marketing-scout`.

Each routine's prompt explicitly hands off out-of-scope candidates to the sibling. If you find an idea drifting across the boundary, fix the prompt that wrote it, not the agent that received it.

| File | Slug | Runtime | Cadence | What it does |
|---|---|---|---|---|
| `daily-board-triage.md` | `daily-board-triage` | Remote | Weekdays ~7 AM PT | **HeyHenry Command Center** — sole synthesizer. Triages board + ideas pool → 5 streams → `ops.decision_bundles` → ONE digest → `/admin/queue` |
| `doc-writer.md` | `doc-writer` | Remote | Daily 5 AM | Engineer-audience module summaries from recent commits → `ops.knowledge_docs` + `ops.docs` |
| `ai-tools-scout.md` | `ai-tools-scout` | Remote | Daily 7 AM | **Collector** — AI/ML tooling scan → `ops.ideas` (no email) |
| `business-scout.md` | `business-scout` | Remote | Daily 6 AM | **Collector** — strategic moves synthesis → `ops.ideas` (`biz-scout`, no email) |
| `helpdesk-triage.md` | `helpdesk-triage` | Remote | Daily 9 AM | Codebase-grounded diagnosis on `triage:claude` kanban cards |
| `security-probe.md` | `security-probe` | Remote | Daily 4 AM | Reviews production surfaces for security regressions → opens incidents |
| `competitive-research.md` | `competitive-research` | Remote | Daily 6 AM | **Collector** — refreshes `ops.competitors` corpus with structured findings |
| `pain-points-research.md` | `pain-points-research` | Remote | Daily 7 AM | **Collector** — mines contractor-community pain points → `ops.social_drafts` |
| `marketing-strategist.md` | `marketing-strategist` | Remote | TBD | **Collector** — tactical marketing (content / launch / acquisition; strategic moves go to business-scout) → `ops.ideas` (`marketing-scout`, no email) |
| `weekly-dispatcher.md` | `weekly-dispatcher` | — | **RETIRED** | Folded into the Command Center daily digest. Do not schedule. |

All connect to the **HeyHenry Ops MCP** at `https://ops.heyhenry.io/api/mcp`. The Local one previously sent email via AppleScript / Mail.app; that path was unreliable. Updated to use `ops_email_send` like the Remote scouts.

## When you change a prompt

1. Edit the markdown here in the repo (source of truth).
2. Paste the updated content into the Routine's Instructions field at `claude.ai/code/routines`.
3. Run once manually to verify; check `ops.heyhenry.io/agents/<slug>` for the new run row.

The repo and the cloud config can drift if step 2 is forgotten — that's the trade-off. If you find them out of sync, the cloud version is what's actually running; copy that back to the repo and figure out why someone changed only one side.

## Required boilerplate

Every routine prompt opens + closes an `ops.agent_runs` row so it surfaces on the agents dashboard. **Use unnumbered headings for these sections** — `Pre-flight` and `Final tool call` — so they never collide with the routine's own step numbering:

- `## Pre-flight — open an agent run` (first content section): call `agent_run_start({ slug, trigger })`. Save `run_id`.
- `## Final tool call — close the agent run` (last content section, before any `Constraints` block): call `agent_run_finish({ run_id, outcome, summary, items_scanned?, items_acted?, payload? })`.

`outcome` enums: `"success"` | `"skipped"` (ran but had nothing to do) | `"failure"` (crashed).

If `agent_run_start` fails, log it but continue — instrumentation must never gate the actual work.

**Why unnumbered**: a routine that already has its own `Step 0` (e.g. ai-tools-scout's "Read your own report card") will end up with two `Step 0`s if the instrumentation is also numbered. Unnumbered sidesteps the collision.

## Rules of thumb for picking Routine vs Vercel cron

- **Routine** when: small reasoning loops, MCP tool calls, narrative output, codebase reading (the sandbox mounts the repo).
- **Vercel cron** when: pre-filter many items, fan-out DB writes, embeddings, multi-API orchestration, fires more than 15×/day (Anthropic Max plan cap).
- **Managed Agent** when: synchronous in-request, unpredictable bursty volume.

In-repo crons live under `ops/src/app/api/ops/<name>/run/route.ts` and use `ops/src/lib/agents/{recordAgentRun, finishAgentRun, withAgentRun}` instead of the MCP tools.

## Every routine has its source-of-truth in this folder. Going forward:

- The cloud config at claude.ai/code/routines is what's actually running. The repo is the place it should match.
- Drift detection is manual: when you edit a Routine in the cloud, paste the new content back into the corresponding `.md` here in the same session.
- If you find a discrepancy when reading a routine you haven't touched in a while (e.g. a copy-paste leak from a sibling routine, like the dispatcher tail that crept into pain-points-research before its capture), the repo wins — paste the repo version into the cloud to clean it.
