# Henry tool-call eval

A fixed battery of scenarios replayed against the **actual realtime model** to
answer one question before a model/prompt change ships: *did Henry's
tool-calling regress?* (Per the "janky private eval suite" strategy — scrappy,
repeatable signal, not a benchmark.)

## Run

```bash
source .env.local && pnpm henry:eval                 # full battery
source .env.local && pnpm henry:eval --limit 2       # smoke (first 2)
source .env.local && pnpm henry:eval --id schedule-shift-chain --verbose
```

Gate a swap by pointing the env var at the candidate model:

```bash
HENRY_OPENAI_REALTIME_MODEL=gpt-realtime-3 pnpm henry:eval
```

Exit code is `0` at/above `--threshold` (default 0.95), `1` below — so it drops
into a one-line ship gate. A markdown report goes to stdout; redirect it:

```bash
pnpm henry:eval > evals/henry/report-$(date -u +%Y%m%d).md
```

## How it works

- Imports Henry's **real** `getSystemPrompt`, `allTools`, and the realtime tool
  adapters — the same things `/api/henry/session` sends. The eval cannot drift
  from production tool definitions.
- Connects to the Realtime API server-side with `OPENAI_API_KEY`, text output
  only (we assert the tool-call decision, not audio).
- Feeds canned tool outputs (`toolStubs`) so multi-step recipes chain
  (e.g. `list_projects → get_project_budget`).
- Asserts the captured tool calls against each scenario's `expect` sequence +
  `forbid` list. See `scenarios.ts`.

## Known divergence from prod

This skips **live speech-to-text and audio turn-taking**. Scenarios that care
about STT mangling carry deliberately-mangled names in their text. A true
audio-path eval is a V2 only if this text proxy proves insufficient.

## Scope (V1)

~14 hand-authored scenarios seeded from the 5 system-prompt recipes + core
flows + the dollars↔cents / id-resolution regressions. **Not** the 30 the card
targets — the path to 30 is real failures fed in by the capture pipeline
(`657092a5`) and a voice thumbs-down, not synthetic padding.

### Not yet (V1.1+)
- Auto-file a kanban card with the failing trace (needs ops MCP from a script).
- Voice thumbs-down → append a failing scenario to the pool.
- LLM-as-judge for genuinely free-text args (today: structural matchers only).
