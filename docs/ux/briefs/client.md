# OD Brief — Project ▸ Client (the operator's side of the client relationship)

> **Grounded in (read these before prompting):**
> - **Route / shell:** `src/app/(dashboard)/projects/[id]/page.tsx` (secondary tab `client`, label "Client", badge = `unreadMessages + unreadIdeas`; sub-nav via `?tab=client&client=<messages|selections|portal>`) → `tabs/client-hub-tab-server.tsx` (thin orchestrator: sub-nav + Suspense-streams the active subtab; default **Messages**).
> - **Messages subtab:** `tabs/messages-tab-server.tsx` → `messages/messages-thread.tsx` (the **shared** thread component, also used by the customer portal's `portal-messages-panel.tsx`) over `project_messages`. Two-way: portal post + **email relay + SMS relay** (`src/lib/messaging/*`). Outbound to customer **debounced 30s**, inbound **immediate**. Shows an amber "portal disabled" warning.
> - **Selections subtab:** `tabs/selections-tab-server.tsx` → `CustomerIdeasSection` (the **idea board** — customer-posted images/links/notes, mig `0201`; opening the tab marks ideas read) + `SelectionList` grouped by room + `SelectionFormDialog` (operator-curated + customer-authored selections, mig `0204`; idea→selection promote via `promoted_to_selection_id`; rolls into the **Home Record**).
> - **Portal & Updates subtab (overloaded):** `tabs/portal-tab-server.tsx` → `PortalToggle` (enable + preview + multi-recipient share), `PortalBudgetVisibilityToggle`, `CustomerViewModeCard` (lump_sum/sections/categories/detailed), `CustomerSummaryCard`, `CustomerSectionsManager`, `PhaseRail`, **Decision queue** (`DecisionForm`/`DecisionList`/`DecisionSuggestions`), and **Portal Updates** (`PortalUpdateForm` — a *manual* composer + the `project_portal_updates` feed).
> - **Pulse (the Henry gap — confirmed):** `src/server/actions/pulse.ts` exists but is wired **only** to the **legacy jobs** surface (`components/features/jobs/update-client-button.tsx` + Henry tool `lib/ai/tools/jobs.ts`). The project Client hub has **only the blank manual `PortalUpdateForm`** — no Henry-drafted update.
> - **Vault (current-state, evergreen):** `Module: Customer Portal` `c3e78671` (the client-facing `/portal/<slug>` this hub mirrors) · `Module: src/lib/messaging` `dd69cc81` (the two-way thread, relay routing, debounce, `P-xxxxxx` refs). Foundation: Positioning `5bfa59be`, Object Model `b4d880be`, Workflow Library `e0263cc3`, Role × Object Matrix `03b1ccf4`, IA/Nav `6529e9ae`. Design system: `DESIGN.md`, `DESIGN-NOTES.md`, `PATTERNS.md` (§3 dialogs, §5 action result, §6 empty states, §7 status, §9 tabs/sub-nav, §18 messaging thread, §20 customer scratchpad, §24 rich-text, §25 live preview, §23 dates), `status-tokens.ts`.
> - **Siblings:** `project-hub.md` §"Client hub" + §Henry "GAP — wire Pulse"; `customer-documents.md` (the client-facing docs the hub curates); `overview.md` (the "Needs You" strip consumes unread client messages/ideas + the Client tab badge); `schedule.md`/portal Gantt (the customer also sees the schedule).
>
> **How to use:** **no OD render exists yet** — paste into OD (HeyHenry "Paper" palette + DESIGN.md clarity discipline), generate hi-fi desktop + mobile for all three subtabs, then run `heyhenry-design-critique`. Feeds Dev cards on the Ops `dev` board, tag `epic:ux-redesign`.
>
> **Naming discipline (carry it through):** the **Client tab** is the *operator's* surface for running the relationship; the **Portal** (`/portal/<slug>`) is the *client's own* surface. The Client tab *configures, curates, and feeds* the Portal; **the client never sees the operator's Client tab.** (Mirror of the Schedule/Calendar split.) *We say **"client," not "homeowner"** — it covers commercial GC work, not just residential.*

**Object / workflow / role(s):** primary objects = **Project Message**, **Selection / Idea**, **Project Decision**, **Pulse Update** (all hung off the Project, customer-facing); workflow = the **client-communication loop** that runs alongside Field Ops (Workflow Library — customer notification is *always* via the thread, human-in-the-loop). Roles: **owner / admin / member** (full); **client** (the *portal*, never the hub); **worker** (never). **Primary action:** *keep the client informed and decided — send the update, answer the message, get the selection/decision — without ever exposing margin.*

## Purpose
The one place the operator **runs the customer relationship**: talk to them (Messages), get their choices (Selections + idea board), and keep them informed + asking for sign-off (Portal & Updates + Decisions). It is the operator-side mirror of the portal — it *curates what the client sees* and *drafts what they're told*. Everything here is customer-facing, so the **client boundary is the governing constraint**: never margin, markup, supplier cost, other customers/projects, internal notes, or unshared photos.

## Current vs target (the delta this brief drives)
1. **Pulse isn't wired — the update composer is a blank box.** The headline Henry gap (`project-hub.md` §Henry, confirmed in code): the project hub only has the manual `PortalUpdateForm`, while `pulse.ts` (Henry drafts a progress update from project activity → operator approves → sends) is stranded on legacy jobs. **Bring Pulse into Portal & Updates** as the primary path; the blank form becomes the fallback. *The* embedded-intelligence story for this hub.
2. **"Portal & Updates" is an overloaded kitchen-sink subtab.** It mixes **set-once portal config** (toggle/share, budget visibility, view-mode, summary, sections) with **ongoing client comms** (decisions, updates feed). Target: split **Portal setup** (configure once, collapse after) from the **client-facing activity** (updates + decisions) so the operator isn't re-reading config every time they post an update.
3. **"What the client sees" isn't curated here.** `project-hub.md` says the Client hub curates which **photos/docs** are shared, but today that lives as a `portal-visible` flag over on Photos/Documents. Target: a lightweight "shared with the client" read (or at least a clear pointer) so the operator knows what's exposed.
4. **Portal-enabled state is implicit across subtabs.** Messages warns when the portal's off; Selections/Updates don't. Target: one legible portal status (on/off + "preview"/"share") visible from any subhead.
5. **Off-brand chrome.** Raw `amber-50/200/900` warning blocks (Messages "portal disabled") → `status-tokens` soft pairs; Paper discipline throughout.

## The three subtabs (grounded)
**Messages** — the two-way thread (`project_messages`, shared `messages-thread.tsx`). Customer replies arrive via portal, **email**, or **SMS** and land in one scrollback; operator replies are **debounced 30s** before sending; `direction` is from the operator's POV (customer-sent = `inbound`). The `do_not_auto_message` contact flag suppresses *AI* sends only, never operator-typed. Portal-off warning here is real (notifications still send; the customer just can't read the thread on the portal).

**Selections** — `CustomerIdeasSection` (idea board: customer-posted images/links/notes; opening the tab marks them read — that's what clears the badge) over `SelectionList` (per-room paint/tile/fixtures/hardware; operator-curated + customer-authored). Ideas **promote to selections**; selections **roll into the Home Record** at closeout. Photo-picker attaches gallery photos to a selection.

**Portal & Updates** — today: portal toggle/preview/**share** (multi-recipient email, audited per recipient), budget-visibility toggle, **customer view mode** (lump_sum→detailed rollup), customer summary narrative, sections manager, phase rail, the **Decision queue** (ask the client to approve/decline/question — pinned atop their portal; `DecisionSuggestions` already has Henry proposing what to ask), and the **Updates** composer + feed.

## Layout (regions → real primitives) — *target reorg*
The sub-nav stays (`Messages · Selections · Portal & Updates`), URL-driven (PATTERNS §9), default Messages, per-subhead unread badges. A small **portal-status chip** (●On / ○Off · Preview · Share) rides the hub header so portal state is legible from every subhead (fixes delta #4).

**Messages** — the shared thread full-height; composer pinned bottom (≥44px send). Restyle the portal-off warning to a `status-tokens` info strip with an inline **Enable portal** link. Optional Henry **"draft a reply"** assist (labeled ✦, never auto-sends).

**Selections** — idea board (customer-posted, with a "promote to selection" affordance per item) → room-grouped selection list + **+ Selection**. Empty: §6 empty state ("No selections yet — add paint, tile, fixtures the client picks").

**Portal & Updates** — reorganize into two clear zones:
- **① Client activity (top, the daily work):**
  - **Updates** — lead with the **✦ Henry Pulse draft** (see Henry §): "Here's a progress update from this week's activity — review & send." Edit inline → **Send** (portal + email/SMS). The blank composer is the fallback ("Write your own"). Feed of past `project_portal_updates` below.
  - **Decisions** — the queue (`DecisionForm`/`DecisionList`) with `DecisionSuggestions` (Henry-proposed asks) inline. Each decision shows its state (pending/approved/declined/questioned) via `status-tokens`.
- **② Portal setup (collapsible, set-once):** the **PortalToggle** (enable/preview/share), budget-visibility, **CustomerViewModeCard** (with the §25 live "what the customer sees" preview), customer summary, sections manager, phase rail. Collapsed by default once the portal's enabled — config, not daily work.

## Henry intelligence touchpoints
Henry = the intelligence behind the relationship, **not a chat box** ([[henry-intelligence-not-chat]]); **outbound to the customer is always human-in-the-loop** (Workflow Library locked — Henry never auto-sends an external artifact).
1. **Pulse — the headline (wire it in).** Reuse `pulse.ts` (`draftPulseAction`/`approvePulseAction`) from legacy jobs into Portal & Updates: Henry drafts a progress update from real project activity (photos added, phase advanced, schedule firmed, milestone hit) → lands as a **✦ draft the operator reviews/edits** → operator **sends** (portal + the deferred email/SMS notify). Replaces the blank-box cold-start. Labeled, editable, never auto-sent.
2. **Decision suggestions (built — keep, surface better).** `DecisionSuggestions` already has Henry proposing what to ask the client (e.g. "tile is on the critical path — ask them to confirm the selection"). Give it ✦ chrome and place it where decisions are created.
3. **Idea → selection / decision (assist).** When a customer posts an idea, Henry can offer **"promote to a selection"** or **"turn into a decision to confirm."** One-tap, operator-approved.
4. **Reply assist (optional).** A ✦ "draft a reply" on the Messages composer for a tedious back-and-forth — drafted, never sent without the operator. Don't turn the thread into a chatbot.
- **Henry-prompt chrome:** rust ✦ + left-border on real Henry actions (Pulse draft, decision suggestion); fill = meaning; `do_not_auto_message` respected (it gates AI sends).

## Connections
- **Customer portal (`/portal/<slug>`)** — the hub configures (toggle/view-mode/sections/budget-visibility), curates, and feeds it; preview before enabling; share is audited (`portal_share_events`).
- **Photos / Documents** — the hub curates *what's shared* (the `portal-visible` flag lives on those tabs; surface a "shared set" read here — delta #3).
- **Overview "Needs You"** — unread **client message** + **idea** rows feed the strip (`overview.md`); the **Client tab badge** = messages + ideas unread. Keep counts consistent.
- **Messaging pipeline** (`src/lib/messaging`) — email/SMS relay back into `project_messages`; `P-xxxxxx` refs; per-tenant Twilio.
- **Selections → Home Record** (closeout) and **Decisions → portal** (pinned approvals).
- **Schedule/Budget** — what the customer sees of those (firm Gantt; budget rollup mode) is governed by settings that live here.

## Role variations
- **Owner / admin / member:** full hub — message, curate selections, configure the portal, draft/send Pulse, manage decisions.
- **Client:** the **Portal** is their surface; **never** the operator's Client tab. The tab's whole job is deciding what reaches them — so the **client boundary is enforced by design**: no margin/markup/cost, no internal notes, no other projects, no unshared photos. (Budget visibility + view-mode are the explicit levers for *how much* money detail they see — never margin.)
- **Worker:** never — no customer-relationship surface in `/w`.

## Mobile vs desktop
*"Mobile = doing work; desktop = thinking work."* Client comms is genuinely both — a lot happens from the truck.
- **Desktop:** full thread + side-by-side selection management + portal config + the live "what the customer sees" preview.
- **Mobile (high-value):** **reply to a message**, **approve & send a Pulse draft**, **answer/post a decision**, glance new customer **ideas** — all ≥44px, capture-light/approve-heavy. Portal *config* (view-mode, sections) is desktop-leaning; don't force it on a phone. The thread composer + the Pulse "review & send" are the two mobile must-haves.

## Financial / Canadian
Mostly **N/A** (comms surface), but it owns the **money-exposure levers**: `CustomerViewModeCard` (lump_sum→detailed) + budget-visibility decide how much cost detail the client sees — render any amounts via `Money` (CAD, tabular, de-emph cents), and **never expose margin/markup** regardless of mode. No GST/Interac here (those live on Billing/portal pay surfaces).

## States
- **Portal disabled:** the hub still works (message + curate + draft), but a clear status chip + "Enable portal so the customer can see this"; Messages keeps its (restyled) notify-only warning.
- **No messages / no selections / no ideas / no updates:** §6 empty states (icon + line + the relevant CTA — "Send the first update," "Add a selection").
- **Pulse draft ready:** the ✦ draft sits at the top of Updates awaiting review.
- **Decision pending:** shown in `status-tokens` warning-soft until the client acts; approved/declined/questioned resolve the tone.
- **Loading:** per-subtab `TabSkeleton` (keep). **Error:** `{ ok, error }` → `toast` (§5).

## Accessibility
WCAG 2.2 AA. Sub-nav is real links, keyboard-operable, badges have text equivalents ("Messages, 2 unread"). The thread is a labelled log; composer ≥44px. Decision/selection state never colour-only (label + glyph + `status-tokens`). The Pulse draft is clearly marked AI-generated with an explicit Send (no silent auto-send). Live portal preview is reachable and labelled. Dates in tenant tz (§23).

## Reject-if self-check (per `heyhenry-design-critique`)
- ✅ Henry = embedded leverage (Pulse draft, decision suggestions), not a chat box; never auto-sends to the customer. ✅ Projects are gravity (every object hangs off the Project). ✅ Client boundary respected by design (the hub's purpose). ✅ No per-seat. ✅ Removes pressure (splits the overloaded subtab; doesn't add a tab). ✅ Canadian money-exposure handled (view-mode, never margin). ⚠ Watch: keep **Client tab = operator mirror / Portal = the client's own surface** crisp; don't turn Messages into an AI chatbot (assist-only); don't surface margin through any view-mode.

## Open questions
- **Decisions: own subhead or stays under Portal & Updates?** It's a distinct, high-value client workflow currently buried in the config-heavy subtab. Option: promote to a 4th subhead `Messages · Selections · Decisions · Portal`. Confirm vs. the §Layout reorg (decisions in the "client activity" zone).
- **Pulse sequencing.** Reuse `pulse.ts` as-is into Portal & Updates, or refresh the draft prompt for the GC/reno vertical first? Lean: wire it as-is, tune copy after.
- **"What the client sees" curation.** A read-only "shared set" (photos/docs currently exposed) in the hub, vs. leaving curation on the Photos/Documents tabs with just a pointer. Confirm scope.
- **Portal-status chip placement.** On the hub header (proposed) vs. repeated per-subtab. Confirm one source.
- **Reply assist.** Build the optional ✦ "draft a reply," or hold it (avoid chatbot creep)? Lean: hold for v1; Pulse first.
- **Idea-board badge semantics.** Opening Selections marks *all* ideas read (current behaviour) — confirm that's right vs. per-item read.
