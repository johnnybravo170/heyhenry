# OD Brief — Inbox / Triage

> **Status:** Draft 1 — first Open Design pass (loop-calibration screen).
> **How to use:** paste into a new Open Design project using the registered **HeyHenry** design system (Paper — warm cream/ink/rust). Generate **desktop (master–detail)** + **mobile (stacked cards)** frames. Then run `heyhenry-design-critique` on the output and iterate.
> **Foundation:** baked into this brief (curated from the Ops vault). Canonical foundation index: [`../README.md`](../README.md).

**Objects:** Lead, Message Thread, Call, Approval (+ Henry Action) · **Workflow:** Lead Intake & Triage (#1) · **Roles:** Owner, Admin · **Primary action:** act on the top item (reply / book / quote / approve / convert)

## Purpose
One place to clear everything that needs the contractor's attention — new leads, customer messages, calls, approvals — with Henry having already classified, extracted fields, and proposed the next action for each. The job is fast triage: confirm or correct Henry's pre-work, then move each item onward. "Inbox zero" should feel achievable, not like a wall of unread.

## Layout
- **Top bar:** "Inbox" + a calm, labeled **Henry triage summary** ("3 new leads, 2 messages waiting on you, 1 approval stale 2 days"). Filter chips: All · Leads · Messages · Calls · Approvals. ⌘K search. **No red unread counter.**
- **List (left / full-width mobile):** one card per item — sender (first name) + channel icon (call/SMS/email/web); **Henry classification chip** (Lead/Message/Approval/Spam, labeled AI, one-tap editable); one-line Henry summary; age + a *quiet* urgency cue; **suggested next action as the card's primary button** ("Book site visit" / "Draft reply" / "Convert to lead" / "Review & approve").
- **Detail (right pane desktop / push view mobile):** full thread or call transcript + Henry's extracted fields (lead: name, phone, scope, address) with **per-field confidence**, low-confidence flagged; action buttons; activity/audit collapsed at bottom.

## Progressive disclosure
- **Snapshot (always):** the triage list — who, channel, classification, summary, next action.
- **Operational:** open an item → detail pane with thread/transcript + fields + actions.
- **Detail:** edit fields, correct classification, play recording / read transcript.
- **Audit:** "Henry classified as Lead (92%) · 2h ago" + actions taken.

## Henry intelligence touchpoints (embedded, never a chat)
Classify every inbound · extract structured fields with confidence · summarize each item + the whole inbox · propose the next action · dedupe ("same caller as this SMS"). Every Henry output is **labeled + editable + undoable**; the user's act is one-tap confirm/correct. **No chat box on this screen** — Henry is the triage intelligence, not a panel.

## Role variations
- **Owner / Admin:** full inbox (core daily work for both).
- **Crew:** no access — leads/triage hidden; crew get Today/Tasks.
- **Homeowner:** N/A.

## Mobile vs desktop
- **Mobile-first (triage from the truck):** stacked cards, tap to expand, one-tap accept/correct Henry's classification, ≥44px targets; capture-now/clean-up-later.
- **Desktop:** master–detail (list + detail pane); batch select for bulk classify/dismiss; keyboard nav (j/k move, Enter open, e act).
- **Offline:** cached recent inbox readable; actions queue + sync on reconnect.

## Financial / Canadian
Light here (pre-money). CA phone format. No tax/holdback chrome — that appears when a lead becomes a Quote (next screen). Don't invent financial chrome here.

## States
- **Empty:** "Inbox zero — nothing needs you right now." + "New leads, messages, and approvals land here as they come in." (Feel ahead, not behind.)
- **Loading:** skeleton cards.
- **Error:** "Couldn't load your inbox — retry."
- **Offline/partial:** "Showing your last synced inbox; new items appear when you're back online."

## Visual identity
Warm paper bg (`#F7F5F0`), white item cards, ink text. Classification chips use status soft-pairs (lead = neutral/info, stale approval = warn, spam = muted). Rust (`#C2410C`) reserved for the single most-urgent accent or the primary action — one pop, not a field of rust. Calm; Linear-not-Buildertrend.

## Reject-if self-check (passed)
No chat box (Henry is inline triage); no per-seat; every item links to a real object; no "47 unread" doom; approval state visible; plain English; AI labeled + undoable; mobile-first; all states specified; warm identity called out.

## Open questions (decide with OD output in hand)
1. **Unified vs channel-tabbed inbox** — recommend one unified stream, filterable by type (calmer; "one app not a stack").
2. **Inbox vs Leads boundary** — recommend Inbox = new/untriaged items only; once triaged, a lead lives in the Leads pipeline (leaves the inbox).
3. **Henry auto-action** — never auto-send/auto-convert; always one-tap human confirm.
