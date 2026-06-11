---
name: od-redesign-loop
description: Drive the HeyHenry × Open Design redesign loop end-to-end with no human copy-paste — write the screen prompt, submit it to the local OD daemon, wait for the render, critique it against the HeyHenry rubric, and iterate until it ships. The human is a checkpoint, not the transport. Use when asked to run or drive the OD loop, iterate a screen through Open Design, redesign a screen headlessly, automate the critique→fix→re-render cycle, or "take this screen through OD without me copy-pasting." Triggers on: drive the OD loop, run the redesign loop, OD redesign, Open Design loop, iterate this screen, headless design loop, automate the OD critique loop.
---

# Driving the OD redesign loop

Run the loop a human used to hand-carry — **prompt → OD render → critique → fix → re-render** — autonomously, surfacing to the human only at checkpoints. You are the *driver*; the judgment lives in skills you call (`heyhenry-screen-design` writes the prompt, `heyhenry-design-critique` is the rubric). The one new piece is the transport, [`od-driver.mjs`](od-driver.mjs), which moves a prompt into the local OD daemon and a result back out. OD spawns your `claude` CLI to do the actual design work and edits the screen HTML in place.

## The pieces (real paths)
- **Transport:** `./od-driver.mjs` (this folder) — `node od-driver.mjs discover|projects|conversations|run|status`.
- **OD project:** resolve by name with `node od-driver.mjs projects` (the `heyhenry-app` row). Don't hardcode the UUID — it changes if the project is re-imported. Its skill is `agent-browser`.
- **One conversation per screen.** Continue a screen's existing thread so OD keeps context — get its id from `od-driver.mjs conversations --project <id>` (the titles are the screen specs).
- **Brief:** `docs/ux/briefs/<screen>.md` · **Render:** `od-project-hub/screens/{desktop,mobile}-<screen>.html`.

## The loop
0. **Check OD is up:** `node od-driver.mjs discover`. If it errors, ask the human to start Open Design (`pnpm tools-dev`) — don't try to start it yourself.
1. **Pick the target screen**; find its brief, conversation, and render files.
2. **Build the prompt (write it to a temp file):**
   - *Round 1:* if a brief/spec exists, use it; otherwise run `heyhenry-screen-design` to produce one (it grounds in the real code + foundation docs first).
   - *Later rounds:* the prompt is the previous critique's **flat punch list** — the fixes, nothing else.
3. **Submit & wait:** `node od-driver.mjs run --project <id> --conversation <screen-convo> --message-file <prompt> --skill agent-browser`. It blocks until the run is `succeeded` (or fails).
4. **Read the render:** Read `od-project-hub/screens/desktop-<screen>.html` (and the `mobile-` one). If the run instead came back asking a question (project shows `awaiting_input`, last message is a question), **checkpoint to the human** — don't guess an answer to a real design decision.
5. **Critique:** run `heyhenry-design-critique` on the rendered HTML → verdict + punch list. **Flatten the list — the critique still tags items P1/P2/P3, but treat every item as a now-fix; never defer one to a "later" tier.**
6. **Decide:**
   - Verdict *Ship* and punch list empty → **done**, go to 7.
   - Else and rounds < 4 → feed the flat punch list back to step 2 and loop.
   - Else (still dirty at the cap) → stop and checkpoint with the outstanding list.
7. **Checkpoint to the human:** the final render (screenshot it with the preview tools, or show the HTML), the round-by-round punch-list history, and the verdict.
8. **Code follow-through → a kanban card.** OD edits are mockup-layer; the real app build is separate. Create the card on the Ops `dev` board, brief-linked to `docs/ux/briefs/<screen>.md`, **proactively — don't ask.**

## Checkpoint cadence (the autonomy knob)
Default: surface to the human **after round 1's render** (confirm direction), **at the end**, and **immediately** on an `awaiting_input` question or a regression (a round that introduces new issues). Iterate autonomously in between. Tunable per request ("full auto, just show me the result" or "stop after every round").

## The White Ledger discipline — lock into every prompt (canonical: `DESIGN.md` v2)
`DESIGN.md` (repo root, v2 "White Ledger", June 2026) is the single source of truth; the render must never diverge from it. Reference render: `od-project-hub/screens/budget-white-v1.html`. Bake this reconciled clause into every R1 prompt (and re-assert it on format passes), then self-audit the HTML before finishing:

- **Surfaces:** page `#F8F8F7`, cards `#FFFFFF` with `rgba(10,10,10,0.10)` hairlines + whisper shadow. **The cream/tan family (`#F3EBDB` etc.) is retired** — zero warm surface tints.
- **Type — one voice.** Inter only, sentence case only. **The 11px mono-caps label tier is retired**: labels = 12px/500/`#57534B` sentence case; mono ONLY for literal id chips; **no uppercase, no italics**. Closed scale: **12 / 14 / 16** + display **20 / 24 / 28 / 36**. No 8/9/10/11/13/15/22/40px anywhere (don't touch SVG width/height).
- **One ink, one accent.** Default buttons ink `#0A0A0A`; **exactly one rust** (`#C2410C`) hero CTA per screen; rust otherwise only ✦ Henry + active states + inline accents.
- **Money:** `tabular-nums`, right-aligned; **cents only at the source-entry tier**, dropped above it; numbers sit on the title's baseline (`align-items: baseline`, icon cells `align-self: center`); `row-gap: 0` on row grids.
- **Status at the datum, never a panel wash.** Soft pairs only; no full-width tinted bands; Remaining < 0 → danger on bar + value.
- **Table grammar:** fills = state only (open-parent tint + hover — nothing else); **brackets include their header row** (category 3px `#AFAFAD`, line 2px `#D4D4D2`, painted above row backgrounds); hairlines between siblings; rows sized by tier (~69/43/31), descent quiets monotonically.
- **Composition:** ≤2 objects above the table (position strip + one card); no legends, no ambient percentages (exception flags only), no meta-counts, no disabled buttons, no nested cards; column headers once (name column header blank); document state on the card's ribbon with ONE visible state action.

This mirrors the app-side enforcement (the `design-tokens` CI lint — updated via the White Ledger build card). Keep the two in sync — if `DESIGN.md` changes, update this clause.

## Watch-fors
- **OD render artifacts vs. real defects.** Oversized glyph/icon overflow bleeding over buttons is an OD *render bug* (a re-render usually fixes it) — flag it as such, don't critique it as a design decision, and don't let it mask the real UI underneath. Verify against the saved render HTML; don't guess the cause.
- **Catch layout/whitespace, not just copy + object model:** empty voids, oversized containers, misalignment, inconsistent padding.
- **Terminology:** "client" not "homeowner"; "category" not "bucket"; always "Henry", never "HH".

## OD contract (for debugging)
Local daemon, no auth, dynamic dev-mode port (hence `discover`). `POST /api/runs {projectId, conversationId, message, agentId:"claude", skillId:"agent-browser"}` → `{runId}`; poll `GET /api/runs/:id` until `status` ∈ {succeeded, failed, canceled}. The render is the on-disk HTML the agent edits. OD also ships a native scored critique and a scheduled-run feature ("routines"/Orbit) — both intentionally unused here; **our rubric (`heyhenry-design-critique`) is the authority**, because OD's generic critique misses HeyHenry-specific issues.

## Related skills
- `heyhenry-screen-design` — writes the OD prompt (round 1) and turns a punch list into fixes.
- `heyhenry-design-critique` — the rubric scored each round.
- `heyhenry-workflow-mapping` / `heyhenry-ooux` — run first if the workflow or object model under the screen is unclear.
