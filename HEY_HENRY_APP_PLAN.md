# Hey Henry Voice App — Build Plan
<!-- STATUS: Phases 1-4 (Gemini Live web voice, tool migration, memory/persistence, video input) ✅ DONE via use-henry.ts + /api/henry/* — implemented with Gemini Live not the original Claude+browser-STT plan | Phase 4b (support desk/tickets) ❓ CHECK | Phase 5+ (Expo native app, Tap to Pay, CarPlay) ❌ NOT STARTED -->

**Date:** 2026-04-17
**Owner:** Jonathan
**Status:** Web voice done; Expo native app not started

## Goal

Ship an iOS + Android app where contractors talk to "Hey Henry" naturally by voice and video. Henry runs their business via tool calls against live Supabase data. In TestFlight in 2 weeks, public app stores in ~4 weeks.

## Success criteria

- Will, JVD, John using daily on their iPhones via TestFlight by day 14
- Voice round-trip latency <500ms
- All 17 existing MCP tools executable from voice
- "Hey Henry, quote this deck" with live camera produces a real draft quote
- Public App Store + Google Play listings by day 28 (subject to review)
- Gross margin >65% at each pricing tier under heavy-usage assumptions

## Architecture

### Brain: Gemini 2.5 Flash Live (single provider)

- Full-duplex audio + video + tool calls in one session
- ~300-500ms latency, interruption/barge-in supported
- Context caching applied: tenant profile + active jobs + recent worklog + operator facts (~30k tokens reused per session, 75% cost reduction on cached reads)
- Fallback pipeline: Cloud STT → Gemini text → Cloud TTS if Live has instability

### Client: Expo (React Native) — fully native

- iOS + Android from one codebase via EAS Build
- **All screens ported to native React Native** (no WebView). Shadcn components mapped to NativeWind / Tamagui equivalents. ~1 hr/screen for mechanical port.
- **EAS Update (OTA)** for rapid iteration — JS/UI/business logic changes ship in minutes, no store review required
- Store review only required for native dependency changes, permission changes, major version bumps
- Offline: not a V1 blocker. Revisit if founding customers hit it (AI won't work offline anyway).

### Voice UX

- In-app wake word "Hey Henry" via Picovoice Porcupine (foreground only — iOS OS restriction)
- Push-to-talk button always visible
- Siri Shortcuts + App Intents for locked-phone invocation ("Hey Siri, ask Henry to start a quote")
- Lock screen widget / Dynamic Island (iOS): one tap to open Henry mic-on

### Data layer (Supabase, existing)

New tables:
- `conversations` (id, tenant_id, user_id, started_at, ended_at, summary)
- `messages` (id, conversation_id, role, content, audio_url, created_at)
- `tool_calls` (id, message_id, tool_name, args, result, status, undone_at)
- `operator_facts` (id, tenant_id, fact, source_conversation_id, created_at, last_used_at)
- `henry_usage` (id, tenant_id, month, voice_seconds, tool_calls_count) — for metering/billing

All RLS-protected via existing `current_tenant_id()` pattern.

## Phases

### Phase 1 — Voice prototype in web (Days 1-2)

Prove Gemini Live works against one tool.

Tasks:
- Add Google GenAI SDK + Gemini Live Session to Next.js app
- Wire `create_todo` as function declaration
- Basic push-to-talk UI on dashboard
- Tenant context injection in system prompt

**Verify:** Voice command "Hey Henry, add a todo to call Mike tomorrow" creates the row in DB and renders in inbox.

### Phase 2 — Tool migration + chat UX (Days 3-5)

Full conversation with all 17 tools, streaming UX, action cards.

Tasks:
- Port 17 MCP tools to Gemini function declarations (mechanical work — same JSON schemas)
- Streaming chat UI: text tokens + tool call cards with inline result + undo button
- Ship `conversations`, `messages`, `tool_calls` tables + RLS
- Per-tool action card renderers (quote created, job updated, photo uploaded, etc.)

**Verify:** 10 representative voice commands across quote/job/customer/photo/worklog — all execute correctly with visible cards and undo.

### Phase 3 — Memory + persistence (Days 6-7)

Henry remembers operator context across sessions.

Tasks:
- `operator_facts` table + `remember_fact` tool
- Auto-inject top 20 most-relevant facts into every new session
- Conversation resume on app open (last 10 turns of most recent thread)
- Prompt caching setup for static tenant context

**Verify:** Teach Henry an operator fact ("Will quotes soft-wash at $0.35/sqft"), restart session, Henry uses it unprompted in a quote.

### Phase 4 — Video input (Day 8)

The killer feature: camera + voice together.

Tasks:
- Enable Gemini Live video frame input on web prototype
- Camera permission UX + preview
- Quote-from-video flow: stream frames → Henry asks clarifying questions → drafts quote

**Verify:** Will generates a real draft quote by pointing camera at his own driveway and talking to Henry.

### Phase 4b — Support desk + ticket system (Days 9-11)

Henry captures bugs, feature requests, and support questions directly from the operator chat — no separate support portal to visit. Platform admin triages from one queue.

Tasks:
- `support_tickets` table: id, tenant_id, user_id, type (bug|feature_request|question|general), title, description, status (open|triaged|in_progress|shipped|closed|wont_fix), priority, source (ai_chat|in_app|email), shipped_in_release_id, credit_cents_applied, credit_applied_at, conversation_id, timestamps
- RLS: operators see only their own tenant's tickets; platform admin sees all
- Henry tools: `file_bug_report`, `submit_feature_request`, `ask_support_question`
- Support-mode detection in system prompt: recognizes "how do I...", "this isn't working", error descriptions, frustration signals → shifts behavior without breaking conversational flow
- Product docs KB (~20-30 articles, inline in context for V1, ~10k tokens, cache-friendly) — Henry answers before filing
- Operator UI: `/support` page with ticket list, status, inline new-ticket fallback form
- Platform admin UI: `/admin/support` triage queue across tenants, filter by type/status/priority
- In-chat ticket cards: render when Henry files one, clickable to full ticket
- Credit hook: when ticket flips to `shipped`, auto-apply $25 Stripe credit + email operator (implementation defers to Phase 8b)

**Verify:** Voice command "Hey Henry, the kanban board won't let me drag jobs on my phone" — Henry asks one clarifying question, files a bug ticket with source `ai_chat`, shows ticket card in chat, ticket appears in `/admin/support` queue.

### Phase 5 — Expo native app (Days 12-16)

Full native React Native app, all screens ported.

Tasks:
- Init Expo app, EAS Build + EAS Update configured, app icon + splash
- Port all Next.js screens to native React Native with NativeWind (Tailwind-compatible) — dashboard, customers, jobs board, quote editor, photos, inbox, settings (~10-15 screens, ~1-2 days)
- Native voice/chat screen (primary UI)
- Native camera + video streaming to Gemini Live
- Porcupine "Hey Henry" wake word (native)
- Expo Notifications (push for job reminders, invoice paid, etc.)
- Siri Shortcuts + App Intents (iOS) for locked-phone invocation
- Shared Supabase client + Drizzle types between web and native

**Verify:** Install on Jonathan's iPhone via Expo dev build. Full flow works: all screens, wake word, voice, video, tool execution, notifications. OTA update pushed and received on next app open.

### Phase 5b — Stripe Tap to Pay (Days 16-18)

Contractors collect payment in the field by tapping the customer's card or phone to their own phone. No extra hardware. Extends existing Stripe Connect setup.

Tasks:
- Integrate `@stripe/stripe-terminal-react-native` in Expo app
- "Collect payment" button on invoice detail screen
- Tap to Pay flow: invoice → tap → paid → job marked complete → Henry auto-logs
- Operator onboarding toggle: enable Tap to Pay on their Stripe Connect account
- Apply for Apple Tap to Pay on iPhone entitlement (1-2 wk review, parallel)
- Apple fallback UI (physical card reader prompt) until entitlement approved
- Android NFC path tested in parallel
- Voice integration: "Hey Henry, collect payment for the Henderson job" → opens Tap to Pay flow pre-filled

**Verify:** Will collects a real tap payment from a real customer in the field. Invoice updates, Henry logs the payment, payout appears in Stripe Connect dashboard.

### Phase 6 — Metering + billing (Days 19-20)

Can't launch without cost protection.

Tasks:
- Track voice seconds per session → `henry_usage` table
- Dashboard widget: "Henry usage this month: 12 / 40 hrs"
- Soft warning at 90% of tier
- Hard cap with upgrade prompt at 100% (with emergency 1hr grace)
- Stripe metered billing for overage minutes

**Verify:** Burn test — run 1 hour of voice on a test tenant, usage numbers accurate, overage billed correctly.

### Phase 7 — Store submission (Days 21-23)

Parallel tasks (some kicked off day 1):
- **Apple Developer Program** signup as Smart Fusion Marketing Inc (D-U-N-S in parallel from day 1 — takes 1-2 weeks alone)
- **Google Play Console** signup ($25)
- Privacy policy updates for mic, camera, voice data handling, data retention
- App Store listing assets: screenshots (6.5" + 6.9" iPhone), 30-char title, description, keywords, category
- Play Store listing assets
- TestFlight internal build → Will, JVD, John installed

**Verify:** Three founding customers installed via TestFlight, using daily.

### Phase 8 — Invite-only beta (Days 24-53)

30-day private beta in TestFlight + Google Play internal testing before public launch. Protects against bad launch-week reviews.

Tasks:
- TestFlight build with Will, JVD, John + 10-20 contractor invitees (recruit via warm outreach, contractor Twitter, local networks)
- Daily usage monitoring: voice session count, tool call errors, crash reports (Sentry)
- Weekly founder check-ins
- Iterate hard on feedback via EAS Update — no store resubmissions needed
- Collect testimonials + case studies for public launch
- Marketing site at heyhenry.io finalized in parallel

**Verify:** 10+ contractors using daily, >20 voice sessions/day per active user, <1% tool call error rate, 3+ quotable testimonials.

### Phase 8b — Public launch (Days 53-63)

- First App Store submission with testimonial-backed listing
- Handle the expected rejection cycle (budget 1 bounce — metadata/privacy)
- Google Play production submission
- Public listings go live — lean into Apple's new-app discovery window (first ~4 weeks post-launch)
- Launch announcement: heyhenry.io, contractor communities, warm network

**Verify:** App searchable in stores under "Hey Henry." Paid signups active from heyhenry.io marketing site.

### Phase 9 — In-app navigation + CarPlay (Weeks 5-7)

The big-leagues move: voice-driven multi-stop routing with CarPlay display. Differentiates Hey Henry hard from Jobber/HCP (who punt to Google Maps).

Tasks:
- Integrate Mapbox Navigation SDK via Expo module
- Route optimization: multi-stop daily routing (job 1 → job 2 → supply → home) with traffic
- In-app turn-by-turn with voice guidance
- Voice commands: "Hey Henry, next stop" / "Add a supply run before my 2pm"
- CarPlay scene + navigation templates
- Apple CarPlay entitlement request submitted (happens after first App Store approval)

**Verify:** Will drives a full day on Hey Henry nav in CarPlay, no falling back to Google Maps.

### Phase 10 — CarPlay entitlement review (Weeks 8-12)

Apple CarPlay review is slow (2-6 weeks). Parallel work: JVD renovation vertical.

**Verify:** CarPlay entitlement approved, CarPlay build live in App Store.

## Pricing model (metered AI, unlimited seats)

| Tier | Price | Seats | Voice hrs/mo | Overage |
|---|---|---|---|---|
| **Starter** | $99/mo | unlimited | 10 | $0.50/min |
| **Growth** | $249/mo | unlimited | 40 | $0.40/min |
| **Scale** | $499/mo | unlimited | 120 | $0.30/min |

Differentiation: every competitor (Jobber, HCP, ServiceTitan) charges per seat. Hey Henry charges for what Henry does. Story: *"Put your whole crew in it. You pay for Henry's time, not your team's size."*

Margin protection:
- Voice caps prevent runaway cost
- Overage is transparent, customer-controlled
- Tool calls and storage are effectively free at this volume
- Prompt caching cuts effective API cost 30-40%

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Apple rejects on wake word / background audio | Keep wake word foreground-only. Use Siri Shortcuts for locked-phone. No background audio tricks. |
| Gemini Live stability issues | Pipeline fallback (Cloud STT → text Gemini → Cloud TTS) designed in from day one. |
| D-U-N-S delay blocks launch | Apply day 1 in parallel with dev work. |
| Heavy users blow up API costs | Voice caps + overage model. Monitor first 10 users weekly. |
| Porcupine native iOS flaky | Push-to-talk always available as fallback. |
| App Store first-review rejection | Budget 1 cycle (~3-5 extra days). Follow Apple's privacy checklist exactly. |

## Decisions (locked 2026-04-18)

| Decision | Choice |
|---|---|
| Apple account | Company — Smart Fusion Marketing Inc, D-U-N-S in parallel |
| Google Play | Organization account, $25 one-time |
| UI approach | Full React Native (no WebView), EAS Update for OTA iteration |
| Offline support | Not V1 — revisit if founders hit it |
| Launch strategy | 30-day invite-only TestFlight beta, public launch day ~45-55 |
| CarPlay | Phase 9, weeks 5-7, Mapbox Navigation SDK |
| Email | Google Workspace on heyhenry.io |
| Pricing | **TBD — revisit before Phase 6 (metering)** |

## What happens after launch

From the Contractor OS Architecture Plan (V2 + V3 verticals):
- **V2: JVD renovation vertical** — change orders, project phases, multi-trade time tracking, materials/receipt capture, customer transparency portal. Spec complete. Build pending.
- **V3: John tile/finishing** — photo pipeline → social, review automation. Planning week of 2026-04-21.
- **Other backlog:** review automation (Twilio SMS), trip logger, platform admin dashboard, revenue dashboard.

Voice app is the differentiator. Verticals are the expansion. This plan delivers the differentiator first.
