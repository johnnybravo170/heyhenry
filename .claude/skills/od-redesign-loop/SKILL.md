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
