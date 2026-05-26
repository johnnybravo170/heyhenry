# Patterns

Reusable UX/code patterns in this app. **Read this before building any new flow.** When you change one instance of a pattern, evaluate every sibling instance in the same family and surface them to the user for a "should I update these too?" decision — do not silently update siblings, and do not silently skip them.

If you introduce a new flow worth standardizing (or extract a one-off into a reusable component), add it here in the same turn.

> **Naming conventions** — for term-level rules (especially "budget category" vs "storage bucket"), see [NAMING.md](./NAMING.md).

---

## 1. File / image upload zones

When you change upload behavior (file size limits, accepted types, drag-drop, optimistic preview, click target on the placeholder, progress UI, error toasts, EXIF stripping, resizing), check every sibling and ask before touching them.

- `src/components/features/photos/photo-upload.tsx` — drag-drop + click + mobile camera; client-side resize; FormData → server action.
- `src/components/features/memos/memo-upload.tsx` — voice memo (MediaRecorder or file); transcription queue; can bundle staged photos.
- `src/components/features/settings/logo-uploader.tsx` — single-file picker; optimistic preview; placeholder square is itself a click target.
- `src/components/features/contacts/intake-dropzone.tsx` — reusable drag-drop + click dropzone used by the contact-intake form (non-customer) and the lead-intake form (customer). File-shape-agnostic; parent owns the file[] state and decides what to do with it (resize images, parse vCards, etc).

**Shared expectations:** all four use the `{ ok, error }` server-action discriminant, all show toast errors, all do optimistic preview where the file is visual. Drag-over state uses `border-primary bg-primary/5` — see photo-upload and intake-dropzone for the canonical styling.

**Offline-capture queue (field path):** project photo uploads survive no-signal. When `navigator.onLine` is false (or a send throws mid-flight), `photo-upload.tsx` stashes the resized blob in IndexedDB via `src/lib/storage/capture-queue.ts` instead of failing. `src/components/features/photos/offline-capture-queue.tsx` (rendered in `gallery-tab-server.tsx`) shows the offline banner + per-item status rows (waiting / syncing / failed) and flushes on the `online` event or a manual "Sync now / Retry all", replaying through the same `uploadPhotoAction`. **Scope:** this is a within-tab queue — no Service Worker / Background Sync registration, so a flush only runs while the tab is open. True background sync (uploads complete with the tab closed) is a follow-up. The bridge between the two halves is a `window` `heyhenry:capture-queued` event.

**Offline time-entry queue (worker `/w`, sibling of the photo path):** a worker logging hours on a no-signal jobsite must never silently lose the entry. `worker-time-form.tsx` checks `navigator.onLine` (and catches a network throw mid-submit) for **new** entries and stashes the `logWorkerTimeAction` payload in its own IndexedDB DB via `src/lib/storage/time-queue.ts` (separate DB name from the photo queue — no shared-version coordination), toasting "Saved on this phone — will sync." `src/components/features/worker/worker-time-queue.tsx` (rendered on `/w/time` above the history list) shows the durable "saved, will sync" banner + per-item status rows and flushes on the `online` event / "Sync now", replaying through the same `logWorkerTimeAction`. **Scope (same as photos):** within-tab only — no Service Worker background sync, so a flush runs while a tab is open. **Edits and invoice submit are NOT queued** — they require a connection (a server row can't be reconciled offline; invoices are money). Expense receipt-blob offline is not yet wired (the camera path is online-only) — a follow-up that should fold into the photo `capture-queue.ts`.

---

## 2. Customer picker / pick-or-create

Anywhere a user selects a customer **must** allow inline-create. Don't drop the user into a separate page.

- `src/components/features/customers/customer-picker.tsx` — base searchable combobox (Command + Popover).
- `src/components/features/customers/customer-picker-with-create.tsx` — wraps the picker with the inline "New customer" form. **Use this**, not the bare picker, in any new flow that needs pick-or-create.

Used by: new-project form, clone-project dialog. Add new callers here.

---

## 3. Confirm / destructive action dialogs

Soft-delete confirmations follow one shape. When you change the wording, button colors, or post-delete navigation in one, evaluate the others.

- `src/components/features/customers/delete-customer-button.tsx`
- `src/components/features/projects/delete-project-button.tsx`
- `src/components/features/billing/cancel-subscription-button.tsx` — two-step variant. Step 1 shows the prorated refund preview + a non-coercive "pause for 30 days" alternative. Step 2 collects an exit-survey reason (radio list) + optional comment, both appended to `refunds_log.notes`. No discount upsell ("would $X off help?") — that line stays locked.
- `src/components/features/projects/schedule-clear-button.tsx` — "Clear & start over" (soft-deletes every schedule task). Controlled-open + hideTrigger so the Schedule toolbar ⋯ overflow hosts it.
- `src/components/features/projects/schedule-regenerate-deps-button.tsx` — "Auto-link dependencies" (wipes + rebuilds dependency edges). Controlled-open + hideTrigger for the same ⋯ overflow; also exposes `variant="inline"` for the non-destructive empty-deps case (runs immediately, no confirm — nothing to lose).
- `src/components/features/projects/schedule-task-editor.tsx` — the task-editor's Delete (soft-delete) confirm lives as a nested AlertDialog driven by local `confirmDelete` state.
- `src/components/features/business-health/owner-draws-panel.tsx` — the owner-draws row Delete confirm: per-row nested AlertDialog driven by local `confirmOpen` state (replaced a native `confirm()`); the description names the draw type + amount + date and reassures the bookkeeper's QBO records are unaffected.
- `src/components/features/team/team-members-table.tsx` — the roster row `⋯ → Remove from crew` confirm: per-row nested AlertDialog driven by local `confirmOpen` (opened from a `DropdownMenuItem` via `onSelect`/`preventDefault`). Names the member + states the consequence (hard delete of the login, can't be undone); owner row's `⋯` is disabled. The `Change role` item above it is intentionally `disabled` ("Coming soon") — role mutation is DEFERRED (needs `updateMemberRoleAction` + `tenant_members` UPDATE RLS).
- `src/components/features/team/pending-invites.tsx` — the pending-invite-row Delete confirm (AlertDialog); Revoke + Resend fire immediately (no confirm — Revoke is reversible by re-inviting). Used invites can't be deleted.

All use shadcn `AlertDialog`, wrap the action in a transition, and surface errors via toast. Delete variants additionally handle `NEXT_REDIRECT`.

`delete-project-button.tsx`, `clone-project-dialog.tsx`, `schedule-clear-button.tsx`, and `schedule-regenerate-deps-button.tsx` each accept an optional controlled-open mode (`open` / `onOpenChange` / `hideTrigger`) so a parent can drive them trigger-less. The project ⋯ overflow (`project-actions-menu.tsx`) hosts Duplicate + Delete this way; the Schedule toolbar ⋯ overflow (`schedule-interactive.tsx`) hosts Clear + Auto-link the same way. Default (uncontrolled, self-triggered) behaviour is unchanged for the projects-table callers.

---

## 4. Inline edit fields (click-to-edit)

Click-to-edit fields use the same keyboard contract: Enter saves, Escape cancels, blur saves. When you change keyboard handling or hover affordance in one, check the others.

- `src/components/features/projects/project-name-editor.tsx` — heading + inline variants.
- `src/components/features/projects/percent-complete-editor.tsx` — slider variant; shows "edit" hint on hover.
- `src/components/features/projects/management-fee-editor.tsx` — number-as-percent variant; writes a worklog entry on change.
- `src/components/features/projects/project-details-card.tsx` — the `▾` Project Details card. Hosts inline editors for name / description / dates (its local `InlineText` + `DateField` follow the same Enter-saves / Escape-cancels / blur-saves contract) and composes `BillingModeEditor` + `ManagementFeeEditor`. This is the consolidated project-settings home that replaced Overview's "facts grid."

---

## 5. Server-action result handling

Every server action returns `{ ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string,string[]> }`. Components branch on `result.ok` and surface `result.error` via `toast.error`. Field-level errors are mapped onto the form via `form.setError`.

If you add a new server action, follow this shape — don't throw from the action for expected errors.

---

## 6. Empty states

Standard shape: icon + headline + 1-line description + primary CTA. Some have a "fresh" vs "filtered" variant — when the variant set changes in one, consider whether the others should match.

- `src/components/features/customers/customer-empty-state.tsx` — fresh / filtered.
- `src/components/features/jobs/job-empty-state.tsx` — fresh / filtered.
- `src/components/features/quotes/quote-empty-state.tsx` — fresh / filtered.
- `src/components/features/invoices/invoice-empty-state.tsx` — single.
- `src/components/features/inbox/todo-empty-state.tsx` — single.

---

## 7. Status badges

Colored pill, one component per status enum. **All color classes are centralized in `src/lib/ui/status-tokens.ts`.** That file maps each status value to a `StatusTone` (`neutral | info | warning | success | danger | hold`), and each tone to a full Tailwind class string. Badge components import the maps and tone-class table — they do NOT declare colors inline.

When you add a new status value to an enum, update the matching `*StatusTone` map in `status-tokens.ts`, **not** the badge component. When you render a status anywhere other than through a badge component (dashboard tile, detail page, etc.), import the tone and class from `status-tokens.ts` — do not hand-roll a color for the same meaning.

- `src/lib/ui/status-tokens.ts` — **source of truth for every status color**
- `src/components/features/projects/project-status-badge.tsx`
- `src/components/features/invoices/invoice-status-badge.tsx`
- `src/components/features/jobs/job-status-badge.tsx`
- `src/components/features/quotes/quote-status-badge.tsx`
- `src/components/features/change-orders/change-order-status-badge.tsx`
- `src/components/features/customers/customer-type-badge.tsx` — contact **kind** pill. The 8-hue kind rainbow was retired (2026-05 UX redesign): a category is not an action, so every kind renders one calm neutral pill. The sole exception is `lead`, which reuses the shared `warning` tone from `status-tokens.ts` ("warm, not closed yet"). Don't reintroduce per-kind colors here — kind is not status. The badges above stay colored because they encode state.
- `src/components/features/inbox/worklog-entry-type-badge.tsx`
- `src/components/features/team/role-badge.tsx` — `<RoleBadge role>` for the Team roster + Add-to-crew dialog. **Role is not status** — it draws from a calm, fixed per-role palette (owner neutral / admin blue / member muted / employee emerald / subcontractor indigo / bookkeeper amber), **never rust** (rust is reserved for the Add-to-crew CTA + ✦ Henry). Label + glyph, never colour-only. `displayRoleFor(role, worker_type)` maps a `tenant_members.role` (+ worker_type) to the visual role — a `worker` renders as Employee/Subcontractor. The badge is **read-only** (no role-mutation action yet — see §3 / DEFERRED).
- `src/components/features/worker/worker-invoice-status-badge.tsx`
- `src/components/features/projects/project-costs-section.tsx` — inline `CostStatusBadge` for the unified Costs surface (`paid_receipt` / `bill_unpaid` / `bill_paid`). Uses the shared `projectCostStatusTone` map in `status-tokens.ts`; no standalone badge file because the three values are tightly coupled to a single rendering surface.
- `src/app/(dashboard)/settings/billing/page.tsx` — inline `PlanStatusCockpit` pill for the GC's **own HeyHenry subscription** (Settings ▸ Billing). The pill reads a *derived* cockpit state (`trialing` / `active` / `cancel_at_period_end` / `paused` / `past_due` / `canceled`), NOT the raw Stripe status — `cockpitState(overview)` layers `pausedUntil` + `cancelAtPeriodEnd` on top of the status first. The state→tone + state→label maps (`subscriptionStateTone` / `subscriptionStateLabel`) live in `status-tokens.ts`. The same surface carries a **founding-rate chip** (rust-soft `bg-[#FEF0E3] text-brand` + lock glyph) and the Change-plan **✦ Henry grandfather guard** — rust is the single accent, reserved for the grandfather promise (chip) and the one primary per card. `change-plan-card.tsx` is **seat-silent**: the plan Select renders name + flat $/mo only, NEVER `PLAN_CATALOG.seatBand` (flat-rate, intent-led positioning — no per-seat language anywhere on this screen).
- `src/components/features/bank-review/bank-review-queue.tsx` — inline `ConfidenceBand` badge for the bank-match review queue (`high` / `medium` / `low` confidence). The band→tone map (`high→success`, `medium→warning`, `low→hold`) lives in `src/lib/bank-recon/confidence-band.ts` (`confidenceTone` / `confidenceLabel`), pulled into the `statusToneClass` + `statusToneIcon` render here. UI copy uses **"confidence band"**, never "bucket" (the matcher's internal `bucket()` stays internal). The CSV preset-detection pill in `bank-import-flow.tsx` reuses the same tones via a local `DETECTION_TONE` map but carries **no ✦** — it's deterministic parser plumbing, not the Henry matcher.
- `src/lib/ui/status-tokens.ts` — `qboSyncStatusTone` (per-row `qbo_sync_status`: `synced→success`, `pending→info`, `failed→danger`, `disabled→neutral`) + `qboRunStatusTone` (import-run lifecycle: `completed→success`, `failed→danger`, `running|queued→info`, `cancelled→neutral`). Rendered through `statusToneClass` + `statusToneIcon` (glyph always carried — never colour-only) in the QuickBooks settings hub (`quickbooks-connect-card.tsx` cockpit pills + "Needs you" strip), the sub-route count badges (`settings/quickbooks/page.tsx`), `qbo-import-history.tsx` (run pill + "rolled back" neutral chip + the `qbo_sync_log` failed-pull `danger` block), `qbo-review-queue.tsx` (pending count), and `quickbooks-import-launcher.tsx` (live counters: skipped→amber, failed→red text; the review/FK/error strips). The per-row `qboSyncStatusTone` badge surface is **reserved for the future push epic** — defined now for consistency, no push UI ships against it. The realm id is **mono, never tokened** (security + noise); sandbox is a `warning` pill ("not your real books"). The Intuit "Connect to QuickBooks" button is the one licensed non-rust brand colour (`#2CA01C`); ✦ Henry appears only on real touchpoints (review dedup match-confidence chip, class→project suggestion) — labelled, operator confirms, never auto-applies.

### 7a. Client-visibility badge (`VisibilityBadge`)

The "who can see this?" badge for any per-item shared/internal surface (Photos, Documents). **Trust-critical state → label + glyph, NEVER colour-only** (WCAG 2.2 AA, SC 1.4.1): internal renders a lock glyph + `Internal`; client-visible renders a globe glyph + `Client visible`, each with a `title` so the meaning is reachable on hover + AT. Colour reinforces, it doesn't carry meaning.

- `src/components/features/projects/visibility-badge.tsx` — the shared primitive (`<VisibilityBadge clientVisible={boolean} />`). Used by `photos/photo-card.tsx` (overlay + lightbox header) and `portal/document-list.tsx` (row). Locked by `tests/unit/visibility-badge.test.tsx`.
- Photos default **internal** (`portal_visibility`/`client_visible` false); documents default **client-visible**; COIs are seeded internal ("sub compliance — usually internal"). The toggle lives in `portal/photo-portal-button.tsx` (popover) and `document-list.tsx` (per-row Hide/Show); the badge surfaces the resulting state legibly. Copy says **client**, never "homeowner."

---

## 8. Calendar / schedule grids

Built on `project_assignments`. The per-project dated drag-to-schedule grid was **removed** when the Crew tab was retired (the roster moved to the Project Details card via `crew-roster.tsx`; dated scheduling is deferred to the future global dispatch board — see `docs/ux/briefs/project-hub.md` §"Crew scheduling"). Revive it from git history (`crew-schedule-grid.tsx`) when that brief lands and the project Schedule tab grows its crew-day slice.

- `src/components/features/calendar/owner-calendar.tsx` — tenant-wide month + 14-day views (rows = projects in 14-day; calendar cells in month).
- `src/components/features/jobs/job-calendar.tsx` — month grid for jobs only.

Shared concerns to keep aligned: weekend dimming, `isToday` highlight, project color hash, ISO date helpers (`parseIso`/`isoDate`).

---

## 9. Tabs / sub-navigation

URL-param driven (`?tab=estimate`); `router.replace()` to avoid history pollution; mobile uses a native `<select>` rather than horizontal scroll.

- `src/components/features/inbox/inbox-tabs.tsx`
- `src/components/features/projects/project-tab-select.tsx` (mobile select)
- The project detail page renders a row of `<Link>` tabs above `lg`, the select below it.
- The customer portal at `/portal/[slug]` introduces a minimal "Project" / "Messages" split via the same `?tab=` query param. Future PRs will likely break the Project tab into Updates / Budget / Photos / Files sub-tabs as those surfaces grow.
- The project **Client hub** (`tabs/client-hub-tab-server.tsx`) is a grouped tab: a top-level `?tab=client` with its own second-level sub-nav (`?client=messages|selections|portal`) rendering the existing Messages / Selections / Portal tab servers. The unread badge (messages + customer ideas) shows on the parent `Client` nav tab; per-subhead badges repeat on the sub-nav. Old `?tab=messages|selections|portal` bookmarks alias to the hub with the matching subtab. This is the model to copy if another set of related tabs needs grouping.
- `src/components/features/tasks/job-tabs.tsx` — distinct-route variant on the job detail page (`/jobs/[id]` vs `/jobs/[id]/tasks`). Used when each tab needs its own server component shell rather than re-rendering off a query param.

**Worker field bottom-nav (`worker-bottom-nav.tsx`):** the mobile-only worker app `/w` uses a fixed bottom nav of exactly **4 primary tabs** (Today · Calendar · Projects · Profile) split around a **raised rust "Log" FAB** (64×64, centered, lifts above the bar; `grid-cols-[1fr_1fr_5.75rem_1fr_1fr]`). The FAB opens a bottom-sheet (`LogSheet`, same component) whose options are **capability-gated**: Log time (always) · Snap receipt (`can_log_expenses`) · Snap project photo · Build invoice (`can_invoice`, else a locked "Off" row). This replaced an overloaded ≤8-tab nav — when a worker surface needs more reach, add it to the Log sheet or Today, **not** the primary nav. Field-hardened sizing: nav row 64px, FAB 64px, sheet options ≥64px; rust is reserved for the Log action + ✦ Henry only. Tokens `bg-chrome` / `bg-paper-soft` (added to `globals.css` + `@theme`) back the nav chrome + inset fills.

---

## 10. Task module (status palette + inline edit + filters)

The Tasks module ships its own status palette (8 values, including orange/purple/teal that don't appear elsewhere). When you add a new status value or render a task chip outside the badge component, update **both** sides:

- `src/lib/ui/status-tokens.ts` — `taskStatusClass` map (per-status Tailwind classes; not a StatusTone — task chips use a richer palette)
- `src/lib/validators/task.ts` — `taskStatuses` enum + `taskStatusLabels` map + matching server-side check constraint in `supabase/migrations/0118_tasks.sql`
- `src/components/features/tasks/task-status-badge.tsx` — read-only badge
- `src/components/features/tasks/task-status-pill.tsx` — interactive Select-as-pill (used for inline status changes)

Sibling instances to keep aligned when the task list UX changes:

- `src/components/features/tasks/project-task-list.tsx` — phase-grouped, filter chips, owner-only Verify button next to `done` rows
- `src/components/features/tasks/lead-tasks-section.tsx` — lead-scope variant (no phases, no job); rows auto-migrate to project scope when a job is created for the lead (see `createJobAction`)
- `src/components/features/worker/worker-task-list.tsx` — mobile worker list; big-tap Done / Blocked / Need Help / Add Photo buttons; `blocked` requires a reason
- `src/app/(dashboard)/todos/page.tsx` — flat personal list, checkbox-style toggle
- `src/components/features/dashboard/command-center.tsx` — read-only Today/Blocked/Needs You buckets; Needs You includes a "To Verify" subsection (owner-only inline Verify / Reject per row)

Inline-edit follows §4's keyboard contract (Enter saves, Escape cancels, blur saves).

---

## 11. Cross-tenant RLS test (every new tenant-scoped table)

Every table protected by RLS must have a cross-tenant isolation test. We
run a single comprehensive runner that provisions tenants A and B,
authenticates as A, and runs five assertions per table:

1. SELECT does not return B's row
2. Targeted lookup of B's row returns null
3. UPDATE on B's row affects zero rows
4. DELETE on B's row affects zero rows
5. Cross-tenant INSERT (with B's tenant_id) is rejected by WITH CHECK

- `tests/integration/cross-tenant-rls.test.ts` — the runner. Add new tables
  by appending to `RLS_TABLE_CASES`. See the comment block at the top for
  the entry shape (table name, seed function, update payload, optional
  insert-rejection payload). The same file also contains an
  `'active-membership scoping (multi-tenant user)'` block that proves
  `current_tenant_id()` honors the active flag — one user with two
  memberships sees only the active tenant's data, switching via the
  `set_active_tenant_member` RPC swaps visibility, and the RPC rejects
  switches to tenants the caller doesn't belong to.
- `tests/integration/customers-rls.test.ts` — older single-table version,
  kept for reference; the comprehensive runner above covers customers too.

When you `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in a migration, you
**must** add an entry to the runner in the same PR. CI catches missing
isolation but only for tables you've registered.

---

## 12. CASL-classified sends

Every outbound email and SMS goes through one of two wrappers, and **every
call must declare a `caslCategory`**. See `CASL.md` for the rulebook. When
you change one send path (template, evidence shape, related type), evaluate
sibling sends in the same family and surface them to the user.

- `src/lib/email/send.ts` — `sendEmail` wrapper. Logs every send to
  `email_send_log`. Required: `caslCategory`. Optional: `caslEvidence`,
  `relatedType`, `relatedId`.
- `src/lib/twilio/client.ts` — `sendSms` wrapper. Logs to `twilio_messages`.
  Same contract.
- `src/lib/ar/executor.ts` — AR engine. Only legitimate caller for CEM
  categories (`express_consent`, `implied_consent_*`). Handles RFC 8058
  unsubscribe + suppression list automatically.

Send-path families to keep aligned when CASL evidence shape changes:

- **Estimate flow** — `src/server/actions/estimate-approval.ts` (4 sends),
  `src/server/actions/quotes.ts` (3 sends)
- **Change order flow** — `src/server/actions/change-orders.ts` (email + SMS
  + internal notify)
- **Invoice flow** — `src/server/actions/invoices.ts` (2 sends)
- **Job lifecycle** — `src/server/actions/jobs.ts`,
  `src/server/actions/project-phases.ts`, `src/server/actions/pulse.ts`,
  `src/server/actions/portal-updates.ts`,
  `src/server/actions/project-messages.ts` (operator notify),
  `src/lib/portal/message-notify.ts` (customer notify, drained by cron)
- **Account / auth** — `src/server/actions/auth.ts`,
  `src/server/actions/onboarding-verification.ts`,
  `src/server/actions/team.ts`, `src/server/actions/billing.ts`
- **Lead intake** — `src/server/actions/lead-gen.ts`,
  `src/server/actions/referrals.ts`
- **Marketing** — `src/lib/ar/executor.ts` (express_consent only)

Never bolt promotional content onto a transactional template — that flips
the send into CEM territory and loses the transactional exemption.

**Supabase auth emails** (magic link, recovery, signup confirmation, invite,
email change, reauthentication) do **not** originate in app code — Supabase
emits them. They are captured by the **Send Email Hook**
(`src/app/api/auth/email-hook/route.ts`), which verifies the Standard Webhooks
signature (`src/lib/webhooks/standard-webhook.ts`, secret
`AUTH_EMAIL_HOOK_SECRET`), renders via `renderAuthEmail`
(`src/lib/email/templates/auth.ts` → `renderEmailShell`), and ships through the
same `sendEmail` wrapper (`caslCategory: 'transactional'`, `relatedType: 'auth'`).
This is the single chokepoint for every auth email — never add a Supabase
default template or custom-SMTP path that bypasses it. Prod is wired in the
Supabase dashboard / Management API (Auth → Hooks) pointing at
`https://app.heyhenry.io/api/auth/email-hook`; the `[auth.hook.send_email]`
block in `supabase/config.toml` stays **commented** (enabling it would force
every `supabase start` to define `AUTH_EMAIL_HOOK_SECRET` — uncomment only to
test the hook locally).

---

## 13. Plan / feature gating

All plan-tier checks go through `src/lib/billing/features.ts`. **Never write inline `if (tenant.plan === 'pro')` checks** — they drift and rot. Adding a gated feature is one line in `FEATURE_TIERS`.

- `src/lib/billing/features.ts` — `FEATURE_TIERS` catalog + `hasFeature` / `requireFeature` / `effectivePlan`. Single source of truth.
- `src/components/features/billing/locked-feature.tsx` — visible-but-locked placeholder with upgrade CTA. Use anywhere a gated feature would render.
- `src/components/features/billing/past-due-banner.tsx` — top-of-shell banner; rendered once in `(dashboard)/layout.tsx`.

Spec rule: gated features are **visible but locked**, never hidden. `past_due` and `unpaid` collapse the effective plan to `starter` at the gate (handled inside `effectivePlan` — call sites don't repeat this logic).

---

## 13b. Role-filtered settings nav + owner-only permission pane

The `/settings` sidebar + mobile list filter their destinations by **role and vertical** from one source of truth, and gated routes render a calm refusal pane (never a crash/403/redirect) for the wrong role.

- `src/components/features/settings/settings-nav-items.ts` — single source of truth. `SETTINGS_NAV` (6 groups, 27 destinations), `getSettingsNav({ vertical, role })` filter, `getSettingsNavCounts(...)` (honest tally for the foot), `GRADUATE_HREFS` (heavy sub-flows that link out: Team, Billing, QuickBooks, Import). **The role × destination matrix is the `ROLE_HIDDEN_HREFS` hide-set** — per-role `Set` of hrefs to hide. Owner = empty set; Ops tweaks the matrix in this one place. Admin is a documented default (keeps Security + Team, hides Billing/Data export/Delete account) flagged for Ops to confirm.
- `src/components/features/settings/settings-sidebar.tsx` — desktop sidebar (sticky, mono uppercase group labels, active = `bg-foreground`, `↗` graduate glyph).
- `src/components/features/settings/settings-mobile-nav.tsx` — mobile grouped-card list (tap → route, ≥44px rows). **Not a `<select>`** — 27 options is a thumb-hostile wall.
- `src/components/features/settings/settings-nav-foot.tsx` — "X of Y shown · N hidden for role · M hidden for vertical · K graduate"; zero-count segments dropped.
- `src/components/features/settings/owner-only-pane.tsx` — `<OwnerOnlyPane title description ownerName />`. One shared lock-glyph pane used by every owner-gated route (`billing`, `data-export`, `team`, `account/delete`). The route still enforces the role server-side — it renders this **in place of** the gated UI instead of throwing. Owner name comes from `getPrimaryOperatorName(tenantId)`.

Nav filter is **defense-in-depth**, not the gate. The matrix is pinned by `tests/unit/settings-nav-role-filter.test.ts` so an Ops tweak shows up as a deliberate diff.

---

## 14. Per-project team checklist (parallel to tasks)

The `project_checklist_items` table is a deliberately lightweight, collaborative-by-default surface for field-level notes ("need 2 pancake boxes for the electrical panel"). It sits next to the heavier `tasks` table — tasks owns PM-level workflow (statuses, assignees, verification, photo requirements); the checklist owns crew-level "stuff we need" notes.

When a feature blurs the line between the two, ask: does this need an assignee, a status beyond done/not-done, or verification? If yes, it's a task. If it's just a checkbox somebody on site jotted down, it's a checklist item.

- `src/lib/db/schema/project-checklist-items.ts` — schema. RLS is open within the tenant (any member can CRUD).
- `src/server/actions/project-checklist.ts` — add / toggle / rename / attach-photo / remove-photo / delete / set-hide-window.
- `src/lib/db/queries/project-checklist.ts` — list-for-project (applies hide window), distinct categories per project, tenant-wide rollup, last-billed-project lookup.
- `src/lib/storage/project-checklist.ts` — separate `project-checklist` storage bucket so ephemeral field snapshots don't pollute the main photo gallery.
- `src/components/features/checklist/team-checklist.tsx` — server entry. Pre-signs photo URLs.
- `src/components/features/checklist/team-checklist-client.tsx` — interactive surface with optimistic state. `chrome="card"` (default) wraps in a titled Card; `chrome="bare"` renders just the add row + list when the host page already supplies title + chrome.
- `src/components/features/checklist/site-switcher.tsx` — popover used on the worker dashboard to switch between assigned projects when the auto-default isn't right.

The hide-completed-after-N-hours setting lives in `tenant_prefs(namespace='checklist').data.hide_completed_after_hours` — `null` means never hide. Default 48h on first read.

Photo lifecycle: attachments are auto-expired ~90 days after the parent project's `completed_at` by a scheduled task (separate concern; the table just stores the path).

---

## 15. Duplicate-detection dialogs

When a server action returns a `{ duplicate: { existing_id, vendor, amount_cents, expense_date } }` shape (overhead expenses today, possibly other entities later), every caller renders the same shared dialog so the user gets a consistent View existing / Cancel / Save anyway flow regardless of entry point.

- `src/components/features/expenses/duplicate-expense-dialog.tsx` — shared dialog component. Props: `duplicate`, `onClose`, `onForceSave`, `busy`.
- `src/components/features/expenses/overhead-expense-form.tsx` — full overhead form caller.
- `src/components/layout/quick-log-expense-button.tsx` — top-bar quick-log caller.

When you add a new caller (or extend the duplicate-detection rule to a new entity type), surface the existing callers and ask the user before changing the dialog's contract. Don't degrade one caller's UX (e.g. swap the dialog for a toast) without explicit decision — that's exactly the bug this pattern was extracted to fix.

---

## 16. AI-assisted entity import (Henry-powered onboarding)

Bringing existing data into the app — customers today, projects/invoices/expenses later — uses a single recipe:

1. **Operator drops a file or pastes text.** The dropzone reuses §1's `intake-dropzone` (file-shape-agnostic) plus a paste textarea. Either input is accepted; the operator picks whichever feels easiest.
2. **Henry classifies via the gateway.** A schema-driven `gateway().runStructured()` call with task `onboarding_<entity>_classify` turns whatever shape came in into a typed proposal array. **Pinned to high-quality models** (Sonnet 4.6, no tier-climb secondary) — this is a Day-1 first-impression moment, cost is irrelevant, sloppy classification undermines the entire product.
3. **Deterministic dedup runs server-side.** AI proposes; deterministic logic decides what's a match. See `src/lib/customers/dedup.ts` for the customer tier system (email > phone > name+city > name). Add a sibling file under `src/lib/<entity>/dedup.ts` for each new entity type.
4. **Preview is ephemeral.** No staging table — the proposal array is round-tripped through the client and edited in place. Operator chooses Create / Merge / Skip per row, optionally edits any field, optionally adds an audit note.
5. **Commit writes an `import_batch` row + tags every created entity with `import_batch_id`.** This gives provenance and rollback. See migration `0185_import_batches.sql` and the matching FK column on customers. New entity phases (projects / invoices / expenses) MUST add their own `import_batch_id` FK in the same shape — don't invent a parallel mechanism.
6. **Rollback is admin-grade and always available.** `rollbackCustomerImportAction(batchId)` soft-deletes via `deleted_at` (NOT hard delete; the records may already be referenced) and stamps the batch row's `rolled_back_at`. Surface a "rolled back" indicator anywhere a tagged row appears.

**Non-negotiables when extending to projects/invoices/expenses:**

- Reuse the `gateway().runStructured()` pattern — never bypass it for "simpler" provider calls.
- Reuse the deterministic dedup contract (return `{ tier, existingId, existingName }`) so the wizard UI is generic across entity types.
- Money + tax math on imported invoices must FREEZE at the rate effective on the historical date, not recompute at today's rate. The customer-facing tax helper in `src/lib/providers/tax/canadian.ts` accepts an explicit override for exactly this case.
- Cross-entity FKs (invoice.customer_id resolved from the customer phase): commit phases in topological order — customers first, then projects, then invoices.

**Cross-entity FK resolution (Phase B onward):**

When an entity references another (e.g. project → customer, invoice → customer + project), the wizard surfaces a per-row resolution column showing whether the reference matched an existing row, will create a new row, or is unattached. Defaults: matched if a strong dedup tier hit; create-new with the reference's name otherwise. The commit pipeline creates the side-effect rows FIRST (tagged with the SAME batch_id) so the FKs land cleanly, then inserts the primary entity rows. Rollback removes the side-effect rows too — this preserves "rollback removes everything from that operation" without forcing a multi-step UX.

**Frozen money math (Phase C onward):**

Imported invoices freeze their `amount_cents` and `tax_cents` exactly as the source recorded — NEVER recompute against today's customer-facing rate. The `import_batch_id IS NOT NULL` flag is the contract that downstream code must check. Same rule applies to historical management-fee rates on imported estimates when Phase C+ extends scope. Code that re-derives money from a different source (e.g. tax provider) MUST skip imported rows.

**Volume / timeout / size:**

Server-action body cap is 50MB framework-wide ([next.config.ts](next.config.ts)). Per-import-action cap is 25MB for text-shaped imports (A/B/C), 10MB per file for receipts (D — matches the live single-receipt flow). LLM input slice is 800K chars (~200K tokens) on text imports. Each import page sets `export const maxDuration = 300` so server actions get 5 minutes on Vercel. Very large files (10K+ rows) need chunking; not implemented yet — kanban entry tracks the gap.

**File-shaped inputs (Phase D onward):**

Receipts and other file-pile imports don't fit the single-shot text recipe — OCR per file is 5–15s, so a 50-receipt batch in one server action would blow past `maxDuration`. The pattern is **client-side fan-out**: the wizard iterates over the dropped files and calls a single-file parse action per receipt, building the preview list with progress UI as results arrive. The commit action takes the aggregated preview state and bulk-inserts in one call. Failed parses don't fail the batch — they render as red rows the operator can either retry, fill in manually, or skip.

Files in this family today:

- `supabase/migrations/0185_import_batches.sql` — `import_batches` table + storage bucket
- `supabase/migrations/0186_projects_import_batch.sql` — `projects.import_batch_id`
- `supabase/migrations/0187_invoices_import_batch.sql` — `invoices.import_batch_id` (frozen-math contract)
- `supabase/migrations/0188_expenses_import_batch.sql` — `expenses.import_batch_id` (frozen-math contract)
- `src/lib/customers/dedup.ts` / `src/lib/projects/dedup.ts` / `src/lib/invoices/dedup.ts` / `src/lib/expenses/dedup.ts` — per-entity dedup engines
- `src/lib/ai-gateway/{tasks,routing}.ts` — `onboarding_customer_classify`, `onboarding_project_classify`, `onboarding_invoice_classify` tasks (all pinned to Sonnet 4.6, no tier-climb). Phase D reuses `receipt_ocr` (Gemini-primary) per-file.
- `src/server/actions/onboarding-import.ts` — Phase A (customers) actions
- `src/server/actions/onboarding-import-projects.ts` — Phase B (projects + side-effect customers) actions
- `src/server/actions/onboarding-import-invoices.ts` — Phase C (invoices + side-effect projects + side-effect customers; frozen money math)
- `src/server/actions/onboarding-import-receipts.ts` — Phase D (one-file-at-a-time OCR + bulk-insert expenses)
- `src/components/features/onboarding/customer-import-wizard.tsx` — Phase A wizard
- `src/components/features/onboarding/project-import-wizard.tsx` — Phase B wizard
- `src/components/features/onboarding/invoice-import-wizard.tsx` — Phase C wizard (with editable money cells)
- `src/components/features/onboarding/receipt-import-wizard.tsx` — Phase D wizard (multi-file fan-out + per-file progress)
- `src/components/ui/decision-toggle.tsx` — the shared 3-segment **Create / Merge / Skip** toggle every entity preview uses (customer / project / invoice / receipt). One implementation, one tone story: active Create/Merge = **rust** (`bg-brand` — a sanctioned rust touchpoint), active Skip = **ink** (`bg-foreground`, a neutral "set aside", deliberately not rust), Merge auto-disabled (chip-fill/muted) when there's no dedup match. Not colour-only: each segment carries its word + a leading check glyph on the active one; the three buttons form a labelled `role="group"` with roving arrow-key focus ("Decision for {label}"). Was duplicated four times across the wizards before extraction. Props: `value`, `hasMatch`, `disabled?`, `onChange`, `label?` (row name for the group label), `mergeHint?` (entity-specific tooltip copy). The time-entry wizard keeps its own *2-state* (Create/Skip) inline control — it has no merge path, so it's not a sibling of this primitive.
- `src/components/features/onboarding/imports-list.tsx` — `/settings/imports` rollback list (per-kind dispatch across all six entity kinds, incl. photos / time_entries; rolled-back rows dim to 60% with a `warning`-toned "Rolled back" badge)
- `src/app/(dashboard)/contacts/import/page.tsx` + `/projects/import/page.tsx` + `/invoices/import/page.tsx` + `/expenses/import/page.tsx` — entry routes (each with `maxDuration = 300`)

All four phases of the kanban card "Henry-powered onboarding import wizard" are wired. Open follow-up: chunked classification for very large text imports (10K+ rows in one paste), and dogfooding with real customer data.

---

## 17. Payment sources (per-tenant card / funding-source catalog)

Receipts log against a `payment_sources` row — debit/credit cards keyed by last 4, plus non-card sources (Personal-reimbursable, Petty cash). The OCR layer extracts `card_last4` and resolves it against the catalog server-side; new cards prompt an inline "Label this card" dialog whose result splices through every sibling row in the same batch.

- `supabase/migrations/0194_payment_sources.sql` — table + RLS + columns on `expenses` (`payment_source_id`, `card_last4` snapshot) + `seed_default_payment_sources` RPC.
- `src/lib/db/queries/payment-sources.ts` — listing, default lookup, lite/full row shapes, `paidByLabel` helper.
- `src/server/actions/payment-sources.ts` — create/update/archive/setDefault/labelCard. `labelCardAction` is the upsert-by-last4 entry point used by the wizard.
- `src/components/features/payment-sources/payment-source-pill.tsx` — read-only pill. Tone follows `paid_by` (amber for `personal_reimbursable`, blue for `petty_cash`, neutral for `business`).
- `src/components/features/payment-sources/label-card-dialog.tsx` — shared inline dialog for naming a freshly-OCR'd unknown card.
- `src/components/features/settings/payment-sources-manager.tsx` + `src/app/(dashboard)/settings/payment-sources/page.tsx` — full management UI.

Sibling instances to keep aligned when this pattern changes:

- `src/components/features/expenses/overhead-expense-form.tsx` — single-receipt form (Paid-by picker + "Label this card" affordance).
- `src/components/features/onboarding/receipt-import-wizard.tsx` — bulk-receipt wizard's Source column (matched-card pill / unknown-card label button / source picker).
- `src/components/features/expenses/expenses-table.tsx` — list view's "Paid by" column.
- `src/server/actions/onboarding-import-receipts.ts` + `src/server/actions/overhead-expenses.ts` — both OCR paths must stay in sync on the `card_last4` + `card_network` extraction prompt and the `paymentSourceResolution` enum.

The QB sync layer (deferred) branches on `payment_sources.paid_by`: business → bank/CC, personal_reimbursable → Owner Equity (reimbursable), petty_cash → Petty Cash. `default_account_code` per source overrides the category-level account code at sync time.

---

## 18. Mobile width: grid + truncate min-width gotchas

Two tightly-related Tailwind/CSS pitfalls that can silently push a layout past the iPhone viewport. Both surfaced together while chasing a "dashboard too wide" bug — neither showed up under static inspection or with `overflow-x-hidden` on `<main>` (that just clipped the visual; the layout had already escaped).

### Rule A — Always set `grid-cols-1` on the base breakpoint when the larger breakpoint sets columns

```tsx
// WRONG — at mobile, grid-template-columns falls back to `none`,
// implicit columns size to grid-auto-columns: auto = max-content.
// Each grid item grows to fit its widest descendant's intrinsic width.
<div className="grid gap-4 md:grid-cols-3">

// RIGHT — explicit grid-cols-1 = repeat(1, minmax(0, 1fr)),
// constraining the column track to the container width.
<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
```

### Rule B — Grid items default to `min-width: auto`, just like flex items

`grid-cols-1` (= `minmax(0, 1fr)`) sets the column track's *minimum* to 0, but the item inside still defaults to `min-width: auto = min-content`. With `truncate` (which sets `white-space: nowrap`) anywhere in the subtree, min-content propagates up to the full nowrap text width — the item then overflows the column track.

`min-w-0` on the grid item is the symmetric counterpart to the flex `min-w-0` trick:

```tsx
// Card grid:
<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
  <section className="min-w-0 rounded-xl border bg-card p-4">
    {/* truncate-laden content here is now safe */}
  </section>
</div>

// Flex row with truncating child:
<div className="flex items-center gap-3">
  <Link className="min-w-0 flex-1 truncate">{title}</Link>
  <Badge className="shrink-0" />
</div>
```

### Quick checklist when a row / card looks "too wide on mobile"

1. Does the wrapping grid have `grid-cols-N` set at the **base** breakpoint? If only `md:`/`sm:` is set, add `grid-cols-1`.
2. Does the grid **item** have `min-w-0`? Required when descendants use `truncate`, `whitespace-nowrap`, or other nowrap text.
3. Does each `flex-1 truncate` element also have `min-w-0` on the same node? Required for truncate to actually constrain in a flex row.
4. Are there hover-only UI elements (`opacity-0 group-hover:opacity-100`, hover-revealed buttons) reserving width on touch devices? Hide on mobile (`hidden md:inline-flex`) — touch has no hover.
5. If static inspection fails, drop in a temporary client-side runtime probe rather than guessing. Walk the DOM, find elements where `rect.right > nearestClippingAncestor.right`, render the top offenders as a fixed banner. Display **everything**; trust the user's eyes; remove the probe in the same commit as the fix.

### Files this pattern was applied to

- `src/components/features/dashboard/command-center.tsx` — outer grid + each Card section + Job Health inner ul
- `src/components/features/dashboard/key-metrics.tsx`
- `src/components/features/dashboard/pipeline-summary.tsx`
- `src/components/features/dashboard/renovation-pipeline-summary.tsx`
- `src/components/features/dashboard/recent-activity.tsx` — flex truncate min-w-0
- `src/components/features/dashboard/money-at-risk-card.tsx` — break-all on phone/email
- `src/components/features/tasks/task-row.tsx` — hover-only Delete button hidden on mobile
- `src/components/layout/workspace-switcher.tsx`, settings/calendar-feed-card, settings/public-quote-link-card, portal/portal-toggle, calendar/assign-workers-dialog, calendar/owner-calendar, expenses/overhead-expense-form, projects/estimate-tab, team/invite-worker-card, team/invite-bookkeeper-card — all `flex-1 truncate` rows that needed `min-w-0`.

---

## 18. Project conversation thread (project_messages)

Single project-scoped messaging log shared by both the operator side (`/projects/[id]?tab=messages`) and the customer portal (`/portal/[slug]?tab=messages`). Every channel — portal, email (Phase 2), SMS (Phase 3) — feeds into the same `project_messages` table so the operator and customer always see the same scrollback.

Outbound (operator → customer) notifications use the **deferred-notify** pattern: schedule on the message row, cancel-and-reschedule when the operator types again within the window, drain via cron. Inbound (customer → operator) notifications fire immediately. Same shape as `project_phases.notify_*` columns — see `PORTAL_PHASES_PLAN.md` Phase 2.

When you change one of these surfaces, **evaluate the other and surface to the user**:

- `src/components/features/messages/messages-thread.tsx` — operator-side thread + composer + 30s pending-send chip with Undo
- `src/components/features/portal/portal-messages-panel.tsx` — customer-side thread + composer (no Undo — customer messages send immediately)
- `src/components/features/projects/tabs/messages-tab-server.tsx` — operator tab server component (loads thread + portal slug + customer)
- `src/server/actions/project-messages.ts` — both sides: `postProjectMessageAction` (operator), `postCustomerPortalMessageAction` (customer via portal slug), `cancelProjectMessageNotifyAction` (Undo), polling fetches, mark-read actions
- `src/lib/portal/message-notify.ts` — customer-facing send helper used by the cron drainer
- `src/lib/email/templates/project-message-operator-notification.ts` — operator-facing email template (matches feedback notification style)
- `src/app/api/cron/project-message-notify/route.ts` — drainer (mirror of portal-phase-notify)

**Polling, not realtime.** Both sides poll every 5s via the relevant get*MessagesAction. Realtime is the obvious upgrade path but adds infra; defer until the polling load is real.

**Customer-facing email contract (Phase 2).** Every email that goes TO a customer must:
1. Set `replyTo: CUSTOMER_REPLY_TO` (= `henry@heyhenry.io`) so the reply lands on `/api/inbound/postmark`.
2. Wrap the HTML body via `appendCustomerEmailFooter(html, projectId)` — adds the `[Ref: P-xxxxxx]` token used as the resolver's tier-2 fallback.
3. If the email is tied to a specific `project_messages` row (currently only the customer-facing portal-message notification fired by the cron drainer), set `headers: customerOutboundHeaders(messageRowId)` and pre-write `external_id` on the row before send.

The helpers live in `src/lib/messaging/email-outbound.ts`. **Don't roll your own** — consistency is what makes the inbound resolver work across tenants. Touched callsites today: `src/lib/portal/message-notify.ts`, `src/lib/portal/phase-notify.ts`, `src/server/actions/estimate-approval.ts` (estimate approval send only — viewed/accepted/feedback notifications go TO operators, not customers).

**Customer reply routing (Phase 2).** Inbound webhook at `/api/inbound/postmark` branches by sender:
1. Tenant_member match → existing bills/sub-quotes flow (`INBOUND_EMAIL_PLAN.md`).
2. Customer email match → `handleCustomerInboundMessage` in `src/lib/inbound-email/customer-message-handler.ts` → 3-tier project resolver (In-Reply-To → footer token → recency-within-tenant) → insert `project_messages` row + immediate operator notify.
3. Neither → bounce.

Multi-tenant safety: the resolver bounces on ambiguity rather than guess. We never surface a customer reply to the wrong tenant.

**Customer SMS routing (Phase 3).** Twilio webhook at `/api/twilio/webhook/inbound` handles STOP/START first (existing CASL flow) then routes normal-text messages via `handleCustomerInboundSms` in `src/lib/messaging/sms-customer-router.ts`. Two-tier resolver: (1) when the To-number matches `tenants.twilio_from_number`, narrow candidates to that tenant — the trivial routing case once 10DLC + per-tenant numbers are live; (2) otherwise, recent-outbound-within-30-days disambiguator. Multi-tenant collision case bounces silently (no insert).

Outbound SMS to the customer is already covered by Phase 1's `sendMessageNotification` (cron drainer), which sends SMS when the customer has a phone. Phase 3 only adds the inbound side.

**Per-tenant Twilio numbers.** Tenants have an optional `twilio_from_number` column (migration 0200). `sendSms` calls `pickTenantFromNumber(tenantId, to)` which prefers the tenant's assigned number, falling back to the country-routed platform default (`pickFromNumber` env vars) for tenants that haven't been provisioned yet. This lets 10DLC roll out tenant-by-tenant — newly-provisioned tenants get the dedicated experience; older tenants keep the shared platform fallback until their number is assigned.

Provisioning is currently manual (Twilio Console + direct SQL update of `tenants.twilio_from_number`). A self-serve settings UI is a future enhancement.

**Read tracking.** Each message has `read_by_operator_at` / `read_by_customer_at`. Operator side fires `markProjectMessagesReadAction` on tab mount; portal side fires `markCustomerPortalMessagesReadAction`. Unread counts drive the badge on the operator's Messages tab pill and the portal's Messages tab.

When adding new channels (Phase 2 email, Phase 3 SMS), the table shape and notification dispatcher stay the same; new feeders just write rows with their channel value. See `PROJECT_MESSAGING_PLAN.md`.

---

## 19. Record-payment dialog (mark invoice paid)

The "mark invoice paid" multi-field collection — payment method, reference, optional notes, optional receipt photo(s) with OCR auto-fill, amount-mismatch warning — lives in **one** shared component and is rendered both from the invoice detail page action bar and inline on the invoice list row. Don't duplicate this UI for new entry points (e.g. dashboard, portal); always reuse the shared dialog so OCR + warning + reset behavior stays consistent.

- `src/components/features/invoices/record-payment-dialog.tsx` — shared dialog. Caller passes a `trigger` ReactNode (the button); the dialog owns method/reference/notes/staged-receipt/OCR state, uploads receipts via `uploadInvoiceReceiptAction`, then calls `markInvoicePaidAction`. Resets on close.
- `src/components/features/invoices/invoice-actions.tsx` — detail-page caller. Trigger is "Record payment" outline button.
- `src/components/features/invoices/invoice-table.tsx` — list-page caller, only rendered for `status === 'sent'`. Trigger is "Mark paid" outline button.
- `src/components/features/projects/invoices-tab.tsx` — project Customer Billing tab caller (Draws + Other invoices tables). Inline button next to View, only for `status === 'sent'`.

When the dialog's contract changes (new field, OCR behavior tweak, label rename), check both callers' triggers + that the underlying `markInvoicePaidAction` / `invoiceMarkPaidSchema` accept any new fields.

---

## 20. Customer-driven scratchpad (write-mostly-from-customer surfaces)

A surface where the **customer authors content into a project** without operator curation, and the operator's only cue is a passive in-app badge — never an external notification. The first instance is the customer idea board (CUSTOMER_IDEA_BOARD_PLAN.md). Future surfaces of this shape (e.g. a customer-side punch-list of post-handoff issues) should follow the same conventions.

Defining traits:
- **Customer writes via portal_slug + admin client** (no Supabase auth context). Operator reads via the standard authed server client + RLS. Mirror `src/server/actions/project-idea-board.ts` for the pair of paths.
- **No external notifications fire on customer writes.** Critical — the whole point of this surface category is that the customer feels safe dumping content. Operator-side passive cue only.
- **Per-item operator-side `read_by_operator_at`** drives a tab-pill unread badge. Mark-read fires server-side on tab open (in the tab's server component), not via a client useEffect — robust to JS-disabled views, no flicker.
- **Operator never deletes customer content in V1.** Customer can delete their own. If a moderation need surfaces later, prefer a `hidden_from_operator_at` flag over actual delete.

Files this pattern was applied to:

- `src/components/features/portal/portal-idea-board.tsx` — customer composer + grid (image / link / note kinds)
- `src/components/features/projects/customer-ideas-section.tsx` — operator read-only view rendered inside the Selections tab
- `src/server/actions/project-idea-board.ts` — paired customer-side (admin client, portal_slug auth) and operator-side (server client, RLS) actions
- `src/components/features/projects/tabs/selections-tab-server.tsx` — operator-side host that mark-reads on render
- `src/lib/storage/idea-board.ts` — storage path helper that reuses the `photos` bucket under a `idea-board-${projectId}` path prefix (no companion `photos` table row)
- `src/lib/idea-board/url-preview.ts` — server-side URL preview fetcher (Pinterest oEmbed + og:image scrape) with SSRF guards + per-slug rate limit

When you change one of these surfaces, evaluate every sibling instance in this family and surface to the user before silently propagating.

---

## 21. Receipt / attachment thumbnail preview in tables

Any table row that has an uploaded receipt, bill PDF, or quote attachment should use the **shared `ReceiptPreviewButton`** instead of a plain "View" link or a decorative paperclip icon. Hover gives an instant thumbnail (image only — PDFs go straight to the click-to-open modal); click opens a full-size dialog with an "Open in new tab" escape hatch.

To make a row usable, the server component must sign URLs in batch (one `createSignedUrls` call per bucket) and pass `attachment_signed_url` + `attachment_mime_hint: 'image' | 'pdf' | null` on each row. Mime hint is derived from the storage path extension — `.pdf` → `'pdf'`, anything else with a path → `'image'`. Legacy URL-only rows (no storage path) pass through with the same shape so the button still renders, just without the hover preview.

The companion convention: the row's **primary identifier** (vendor name, expense vendor, etc.) is itself a button that opens the edit dialog — the explicit "Edit" button stays for discoverability but is no longer the only path.

Files this pattern was applied to:

- `src/components/features/expenses/receipt-preview-button.tsx` — the shared component (paperclip → hover thumbnail → modal; PDFs render in iframe).
- `src/components/features/expenses/expenses-table.tsx` — overhead expenses list (signing in `listOverheadExpenses`).
- `src/components/features/projects/expenses-section.tsx` — project Costs > Expenses subtab.
- `src/components/features/projects/costs-tab.tsx` — project Costs > Bills subtab (Bills table; legacy `receipt_url` falls through as image).
- `src/components/features/projects/sub-quotes-section.tsx` — project Costs > Vendor quotes subtab (preview button placed outside the row's expand `<button>` so it doesn't toggle expand).
- `src/components/features/projects/tabs/costs-tab-server.tsx` — server-side URL signing for expenses (`receipts` bucket), bill attachments (`receipts` bucket), and quote attachments (`sub-quotes` bucket).

When you add a new table that surfaces uploaded files, reuse `ReceiptPreviewButton` and sign URLs in batch — don't introduce a new "View" link or rely on `<a target="_blank">`. POs are intentionally excluded (they have no attachment field; they're system-created, not uploaded).

---

## 22. Expense tax-split chip (auto-split on Total blur)

Any expense form that needs a pre-tax / tax breakdown for the cost-plus markup base should use the shared **`ExpenseTaxSplitChip`** rather than rolling its own disclosure or extra inputs. The chip sits below the Total field, auto-splits via the tenant's effective GST/HST rate on blur, and lets the operator override per-expense for out-of-province / non-registered receipts.

State machinery the parent owns:

- `preTaxCents`, `taxCents` — number-or-null. Submit handler forwards both to the server.
- `splitMode: 'auto' | 'ocr' | 'manual'` — drives chip labelling and the recompute decision.
- A `showTaxSplit` boolean — the chip is hidden for fixed-price projects (`project.is_cost_plus === false`) and when the tenant has no tax rate (`tenantTaxRate <= 0`). Overhead expenses always show it (bookkeeping value even without markup).
- On Total blur: recompute via `splitTotalByRate(totalCents, rate)` from `src/lib/expenses/tax-split.ts`. Skip when `splitMode === 'manual'`. If `mode === 'ocr'` and the breakdown still reconciles to the new total, leave it alone.
- On project switch / mode switch: refresh from current Total (if any) so the chip reflects the new context.

Files that follow this pattern:

- `src/components/features/expenses/expense-tax-split-chip.tsx` — the shared chip component.
- `src/lib/expenses/tax-split.ts` — `splitTotalByRate(totalCents, rate)` math + `tests/unit/tax-split.test.ts`.
- `src/components/layout/quick-log-expense-button.tsx` — owner Log Expense dialog (project mode + overhead).
- `src/components/features/worker/worker-expense-form.tsx` — worker expense form (project mode only; workers don't log overhead).

The tenant tax rate comes from `canadianTax.getCustomerFacingContext(tenantId).totalRate`. Server pages that render either form must fetch and pass it as a prop; today that's the dashboard layout (`src/app/(dashboard)/layout.tsx` → `Header → QuickLogExpenseButton`) and the worker expense page (`src/app/(worker)/w/expenses/new/page.tsx`).

When you add another expense-creation surface, fetch the tax rate server-side, reuse the chip + helper, and gate visibility on the same two conditions (cost-plus project OR overhead, AND `tenantTaxRate > 0`).

---

## 23. Dates: always render in the tenant's timezone

The runtime tz on Vercel is UTC. Bare `Date.toLocaleDateString(...)` / `toLocaleTimeString(...)` / `new Intl.DateTimeFormat(...)` without an explicit `timeZone:` formats in UTC, which silently shifts dates for any user not in UTC — typically late-evening Pacific users see tomorrow's date on yesterday's job.

Every Date display has to honor the contractor's tenant tz. Three primitives:

- **`formatDate(iso, { timezone })`** — from `src/lib/date/format.ts`. The canonical helper. Use it in any non-AI server code where you have an ISO string + a tenant tz on hand.
- **`useTenantTimezone()`** — from `src/lib/auth/tenant-context.tsx`. Client-side hook that reads from the `TenantProvider` wrapper in the dashboard, worker, and public-portal layouts.
- **`new Intl.DateTimeFormat('en-CA', { timeZone, ... }).format(d)`** — for one-off formats (different style options than the helpers offer). Always pass `timeZone:`.

Lint guardrail at `tests/unit/timezone-no-bare-tolocale.test.ts` blocks bare `toLocaleDateString` / `toLocaleTimeString` / `new Intl.DateTimeFormat(...)` calls in CI. The file's allowlist documents the deliberate runtime-tz round-trip exceptions (calendar grids that pair `parseIso` with bare formatting symmetrically — Date constructed *and* formatted in the same tz, used as opaque date keys).

Adjacent gotchas the lint rule does **not** catch:

- **`Date.prototype.toLocaleString(...)`** on a Date — the rule only catches `Date|Time` variants because numeric `.toLocaleString()` is heavy. Don't call `Date.toLocaleString` without `timeZone:`.
- **`Date.getHours()` / `getDate()` / `getDay()` / `getMonth()` / `getFullYear()`** — all return runtime-tz values. Code that buckets a Date into morning/afternoon/evening, or computes "today's day of week", must extract the field via `Intl.DateTimeFormat` with a tenant tz.

For AI tool handlers, the `setToolTimezone(tenant.timezone)` hook in `src/app/api/henry/tool/route.ts` already fans out to dashboard, invoice, and the shared `lib/ai/format.ts` formatters. New AI tool formatters that go through `setToolTimezone` are tz-correct by default.

For Home Records, the snapshot freezes `timezone` at generation time (`HomeRecordSnapshotV1.timezone`). The PDF / ZIP / public web view all prefer the snapshot's frozen tz — the document is a permanent artifact, so dates render in the tz the work was actually done in even if the contractor relocates the business later.

---

## 24. Rich-text fields (markdown editor + safe render)

Any description field that benefits from formatting (bold, italic, bullet/numbered lists, h3/h4) uses the shared **`RichTextEditor`** for writing and **`RichTextDisplay`** for reading. Storage is **plain markdown text** in a `*_md` column on the row — portable, easy to migrate, easy to grep.

The editor is intentionally NOT a WYSIWYG. It's a textarea + toolbar — the operator sees raw `**bold**` while typing, the toolbar inserts the syntax at the cursor (and `Ctrl+B` / `Ctrl+I` shortcuts work). GitHub-style edit box. Predictable, zero ProseMirror/TipTap dependency, ~zero bundle hit.

The display is `react-markdown` with default settings — **raw HTML is escaped, not rendered**. We do NOT use `rehype-raw`. Custom `<a>` renderer forces `target="_blank" rel="noopener noreferrer nofollow"` and the sanitization test (`tests/unit/rich-text-sanitization.test.tsx`) is the regression guard. If you change the display to allow HTML pass-through, that test MUST fail until you wire in `rehype-sanitize` with a strict allowlist.

Supported markdown surface (intentionally narrow): `**bold**`, `*italic*`, `` `inline code` ``, `- bullet`, `1. numbered`, `### h3`, `#### h4`, `> blockquote`, `[link](url)`. No images, tables, raw HTML, or fenced code blocks.

Files in this family:

- `src/components/ui/rich-text-editor.tsx` — the editor (toolbar + textarea). Controlled (`value` / `onChange` + optional `onBlur`).
- `src/components/ui/rich-text-display.tsx` — read-side renderer. Pairs with the editor.
- `tests/unit/rich-text-sanitization.test.tsx` — XSS regression guard.

Sibling instances to keep aligned when this pattern changes:

- `src/components/features/projects/customer-sections-manager.tsx` — section description (`description_md` on `project_customer_sections`).

When you add a new `*_md` column, store and edit with this pair. Do NOT introduce a parallel rich-text component — the security surface needs to stay singular. If you need more formatting (tables, images), extend the existing pair AND extend the sanitization test in the same change.

---

## 25. Live preview with toggles (operator-facing "what will the customer see")

Surfaces where the operator picks a presentation mode and needs to *see the result* before applying. Solves the "abstract setting is opaque" problem — the operator toggles, the preview rebuilds in real time, then they hit Apply to materialize.

Architecture, in three layers:

1. **Pure helper** (`*-line-items.ts` / `*-rollup.ts` style). Takes all inputs as plain data, returns the computed shape. No DB access, no React, no side effects. Testable as a pure function. The helper is the single source of truth — both the client preview and the server-side Apply action run the same function with the same inputs.
2. **Server-side loader query** (`load*Inputs(id)`). Fetches the underlying project data + resolves "what is the current default" once on page load. Page passes the loaded inputs as props to the client component.
3. **Client preview component** (`'use client'`). Holds toggle state in `useState`, calls the helper via `useMemo` on every render, displays the result. Apply button invokes a server action with **just the toggle values** — the action re-fetches inputs server-side via the same loader and re-runs the helper. We never trust client-sent computed line items into the DB.

Why this shape:

- **Subtotal/total invariance is testable**. Unit tests on the helper assert that switching modes doesn't change the customer's total — a regression guarantee the operator can rely on.
- **Apply is destructive but obvious**. The materialized shape replaces the persisted one; there's no surprise because the operator already saw what would land.
- **Manual edits still work**. After Apply, the existing add/remove line-item actions mutate the persisted `line_items` JSONB. The preview is for the macro shape; manual edits handle the fiddly bits.

Refused complexity:

- **Compute on read, never persist.** Tempting but breaks PDF renderers, public customer view, and manual edits. Materialize on Apply.
- **Per-line hide toggles.** Add/remove actions already exist. Don't double-cover.

Files in this family:

- `src/lib/invoices/customer-view-line-items.ts` — pure helper (the canonical example of this pattern).
- `src/lib/db/queries/invoice-customer-view-inputs.ts` — server-side loader.
- `src/components/features/invoices/invoice-view-mode-preview.tsx` — client preview component.
- `src/server/actions/invoices.ts` → `applyCustomerViewToInvoiceAction` — Apply action.
- `tests/unit/customer-view-line-items.test.ts` — subtotal-invariance regression guard.

Persistence convention: store the **toggle values** on the parent row (`*_view_mode`, `*_view_*_inline`), nullable, where null = "inherit from a parent default" (e.g. project's `customer_view_mode`). The materialized shape lives in its own JSONB column (`line_items`). Both are written together on Apply.

When adding a new live-preview surface, mirror these five files. Don't invent a new layering — keep the three-layer separation (helper / loader / client) so the helper stays testable as a pure function.

---

## 26. Dialogs scroll by default — don't re-add overflow handling

The base `DialogContent` and `AlertDialogContent` ship with `max-h-[90dvh] overflow-y-auto`. Long-form dialogs (multi-field intake, expense logging, project intake) scroll *inside* the dialog body on mobile instead of overflowing the viewport and clipping the primary submit button.

Don't re-add `max-h-*` or `overflow-y-auto` on the caller — they're already there. Layer your own `max-w-*` / `sm:max-w-*` width caps as needed. Use `dvh` (not `vh`) anywhere a custom height cap is unavoidable, so iOS Safari's dynamic bottom chrome doesn't clip the bottom row of buttons.

- `src/components/ui/dialog.tsx` — base `DialogContent`.
- `src/components/ui/alert-dialog.tsx` — base `AlertDialogContent`.

If you find yourself wanting to opt out (e.g. a dialog that should never scroll), prefer making the dialog body shorter — that's the bug.

---

## 27. State strip — lifecycle moment + actions  *(design primitive, OD-only)*

A horizontal panel that *labels* a project / object lifecycle moment and carries its primary actions. Sibling pattern to the Schedule cascade card and the Billing Ready-to-bill nudge — same chrome family, different soft-pair flavour per state. Lives at the **top of a tab body**, above the summary card, never as floating chrome.

Use a state strip whenever a tab body has actions whose meaning depends on the *current state* of the object — approval flows, sent/awaiting-response, ready-to-bill, cascade-pushed dates, ready-to-deliver, blocked. The strip both *announces* the state and *exposes* the one or two actions that move it to the next state.

**Four soft-pair variants, all share chrome:**

| Variant | Background | Border-left | Mark fill | Typical content |
|---|---|---|---|---|
| `.is-pending` | `--rust-soft` | `--rust` | `--rust` | "Budget has unsent changes — send for re-approval" + ghost `Mark approved` / ghost `Mark declined` / rust `Preview & send` |
| `.is-sent` | `--info-soft` | `--info` | `--info` | "Sent to customer Mar 24 · awaiting response" + ghost `Resend` / ghost `Withdraw` |
| `.is-approved` | `--card` (calm) | `--ok` | `--ok-soft` | "Approved Mar 25 by Daniel & Priya" + link `View customer view` / link `Revise` |
| `.is-declined` | `--warn-soft` | `--warn` | `--warn` | "Declined Mar 26 — Daniel asked to drop the kitchen island" + ghost `Address feedback` / rust `Re-send` |

**Rust discipline**: the rust primary CTA appears in at most ONE variant per screen (usually `.is-pending`); state-flip ghost actions don't get rust. Use `.btn-rust` (desktop) / `.ss-btn-rust` (mobile) only for the single "move forward" action.

**Mobile layout**: stacks vertically — `.ss-head` (mark + body) on top, then `.ss-actions` with the two ghost buttons in a 2-col grid above a full-width 44px rust primary. Never crush the three buttons onto one row at phone widths.

**Specificity gotcha** *(found while building mobile-budget.html — 2026-05-22)*: the `.state-strip.is-pending .ss-btn` ghost override beats a bare `.ss-btn-rust` rule on specificity. Declare the rust primary as `.state-strip .ss-btn.ss-btn-rust { … }` so the doubled-class selector wins the tie. Same fix applies to `.is-declined .ss-btn` once the declined-state Re-send button lands.

**Canonical OD source** (until ported to React):
- `od-project-hub/screens/desktop-budget.html` — `.state-strip.is-pending` between alert-chips and signed-banner; rust CTA = `Preview & send`.
- `od-project-hub/screens/mobile-budget.html` — same, stacked layout; full-width rust CTA.
- `od-project-hub/screens/desktop-schedule.html` — warn-soft cascade card (cousin of `.is-declined`): "Moving Drywall +3d pushed Finishes, Punch List & Final Walkthrough" with `Undo` + rust `Notify customer`.
- `od-project-hub/screens/desktop-billing.html` — Ready-to-bill peach nudge (cousin of `.is-pending`): "Rough-in's done — bill draw 3 ($12,400)?" with rust `Bill draw 3`.

**When the React port lands**, factor a `<StateStrip variant="pending|sent|approved|declined" mark={…} body={…} actions={…} />` primitive sitting next to `Card` in `src/components/ui/`. The four variants are the only legal ones — refuse "info" / "neutral" requests; if a moment doesn't fit one of the four soft pairs, it doesn't belong in a state strip.

**First React port (warn-soft cascade family, embedded Henry):** the Schedule tab's `ScheduleCascadeExplainer` (`src/components/features/projects/schedule-cascade-explainer.tsx`), `ScheduleSlipPrompt` (`schedule-slip-prompt.tsx`), and `ScheduleCoSuggestion` (`schedule-co-suggestion.tsx`) are the React implementations of the warn-soft cascade card. All three reuse the Henry chrome convention directly — `rounded-r-lg border border-l-2 border-l-brand p-3` + `statusToneClass.warning` + a mono rust `✦ Henry` eyebrow (the same family as `henry-insight-strip.tsx` and the portal-tab decision-suggestions wrapper). When the `<StateStrip>` extraction happens, fold these in as the warn-soft variant rather than re-deriving the chrome. Notify routes through the existing deferred-notify path (`notifyCustomerOfScheduleChangeAction` → the mig-0211 cron + 5-min Undo), never a new send system. `ScheduleCoSuggestion` is the **CO → schedule** touchpoint (closes vault gotcha #13 — change orders weren't linked to the Gantt): an approved CO surfaces an inline ✦ prompt to draft schedule task(s) for its added scope (one task per budget category, rough + client-hidden), accept/edit (per-scope editable name + "Add after" predecessor picker) or dismiss — dedup via `change_orders.schedule_suggestion_dismissed_at` so it never auto-inserts and never re-nags. It's the one place dollars (`<Money>`/CAD) legitimately appear on the otherwise money-free Schedule tab.

**Henry attention-strip family (account/money-side, rust-soft fill):** the Business Health cockpit's `BusinessHealthAttentionStrip` (`src/components/features/business-health/attention-strip.tsx`) is the money-side, account-level mirror of the project Overview `henry-insight-strip.tsx`. Same rust `✦ Henry` eyebrow + deterministic, rule-based engine (`src/lib/db/queries/business-health-attention.ts` — the money-side mirror of `project-insights.ts`), but **action-first** (each row leads with the CTA: rust "Send reminders" for overdue AR, ghost "Review bills" for net-cash-negative) and rendered on a rust-soft fill (`bg-[#FEF0E3]` + `border-l-[3px] border-l-brand`) rather than per-row status tones. **Calm discipline:** unlike the Overview engine (which emits a calm `on_track` line), this returns `[]` and the strip is hidden entirely when nothing's pressing — Business Health's home-base read is the cockpit numbers, the strip only appears when there's something to act on. The cockpit detail aggregates (AR aging bands, overdue itemisation, 6-month cash series, near-term cash) live in `src/lib/db/queries/business-health-cockpit.ts` (tax-aware via `invoiceTotalCents`, tying out to the `get_business_health_metrics` RPC totals).

**Sibling pattern siblings to retire when porting**: `signed-banner` (= `.is-approved`), the `chip-alert.is-warn` for "unsent scope changes" (becomes `.is-pending`), and any one-off "preview & send" button floating above a card body (always wrap in `.is-pending`).

**Home Record React port (lifecycle-as-flow, off the canonical four variants):** the operator Home Record flow (`src/components/features/portal/home-record-flow.tsx`, on the project Documents tab) is the first React state-strip that drives a *generate → preview → send* lifecycle rather than an approval. It maps the four document-lifecycle moments to the same chrome family — `snapshot` = rust-soft `bg-[var(--rust-soft)]` + `border-l-brand` (the one rust primary: `Preview & finish`); `ready` = calm `bg-card` + emerald left-border (primary `Email to client`); `sent` = emerald-soft confirmation (primary demotes to `Resend`). Below the strip sits a **readiness line** (Web link · PDF · ZIP) of soft-pair chips (built = emerald, not-built = neutral, stale = amber `AlertTriangle`). Format-building + the ✦ Henry closeout-summary editor live in a **preview drawer** (a wide `Dialog`, not a Sheet — none exists yet); `Regenerate` is one `AlertDialog` (§3). When `<StateStrip>` is extracted, this is a lifecycle variant set distinct from the approval four — keep them separate rather than forcing Home Record into `pending/sent/approved/declined`.

**Invoice-detail React ports (status posture + inline cautions):** the operator invoice detail page (`src/app/(dashboard)/invoices/[id]/page.tsx`) reuses the same chrome family for two roles. (1) The page-level **status posture** — sent = `statusToneClass.warning` "Awaiting payment", paid = `statusToneClass.success` receipt block (date · method · ref · receipt thumbnails §21), void = `statusToneClass.neutral` closed — rendered via a local `PostureStrip` (`rounded-xl border border-l-2 border-l-brand` + a status tone). (2) The **inline cautions** — `CostBasisDriftBanner` (warn) and `MissingGstNotice` (danger) — were full amber/red banners, now `rounded-r-lg border border-l-2 border-l-brand p-3` + `statusToneClass.{warning,danger}` matching `ScheduleSlipPrompt`. When `<StateStrip>` is extracted, fold `PostureStrip`'s warning/success/neutral tones in rather than re-deriving; the inline cautions stay as the thinner caution variant.

## 28. Customer-facing money document (`<CustomerDocument>` shell)

The one branded wrapper every customer-facing money document renders inside — **Estimate · Change Order · Invoice/Pay**. It is the GC's letterhead, not HeyHenry operator chrome: signed logo + business name up top, a quiet "Powered by HeyHenry" footer, **Henry invisible**. Hard boundary — **price-only**: never `unit_cost` / `markup_pct` / supplier cost / margin renders through it.

`src/components/features/projects/customer-document.tsx`. Promoted out of the old `estimate-render.tsx` (the only prior reusable customer render). The shell owns, identically across all three docs:
- **Header** — logo (or text name) + optional business meta · doc eyebrow / number / date · status chip
- **Recipient grid** — "Prepared for" / "Billed to" {customer} + optional project column
- **Body slot** (`children`) — the doc's own content (estimate scope tree · CO diff · invoice line items)
- **Totals block** — `Subtotal → Management fee → province-aware GST/HST → Total`, every row through `<Money>` (de-emph cents, tabular). Pass `totals.rows` in display order; the Total row renders separately + emphasized. `meta` on a row is the small uppercase tax note ("BC · on top").
- **Footer** — GST# · WCB# · `footerNote` · "Powered by HeyHenry"
- **Action zone slot** (`actionZone`) — the one thing to do (Approve e-sig / Pay), rendered after the footer.

**Status chip** comes from `status-tokens.ts` (`{ label, tone }`) — no ad-hoc amber (§7). **Dates** are pre-formatted by the caller in the tenant tz (§23); the shell is client-agnostic, no tz logic inside.

**Adopters:**
- `src/components/features/projects/estimate-render.tsx` — Estimate (live). Body keeps its section→category→line grouping + approved/declined/draft banners; header/recipient/totals/footer + chip come from the shell.
- `src/app/(public)/view/invoice/[id]/page.tsx` — Invoice pay surface (live). Draw context + line items in the body; dual-pay zone (`InvoicePayZone`) in the action slot.
- **Change Order** public `/approve/[code]` page — **live** (card 01a46861), via `src/components/features/change-orders/change-order-render.tsx` (the CO analogue of `estimate-render.tsx`, shared by the public page; reuse it for any operator CO preview). Body = "What's changing & why" + price-only impact card + the Before→After→Δ diff (`ChangeOrderDiffView`); totals use `CustomerDocTotalsRow.signed` for the +/- Cost of work → Management fee → province-aware GST/HST → Total impact; `actionZone` holds the typed-name e-sig + decline-with-reason form. Tax via `canadianTax.getCustomerFacingContext` (PST stripped) — never hardcode 5%.

**Home Record artifact — letterhead conventions, not the money-doc shell.** The public Home Record (`src/app/(public)/home-record/[slug]/page.tsx`) is a long-form *narrative* document (summary → phases → selections → photos → decisions → change orders → documents), not a priced doc, so it does NOT render inside `<CustomerDocument>` (no totals block, no action zone, no GST/WCB footer). It instead **adopts the same letterhead language** on the warm Paper field: GC logo (or text-name fallback) + "Home Record" rust eyebrow + project h1 + "Prepared for {client}" + frozen-tz generated date; rust (`text-brand`/`border-brand`/`bg-brand`) is the single accent (section rules, eyebrows, the Download PDF/ZIP buttons); footer is "Save this link — it works forever" + one quiet "Powered by HeyHenry". **Server-only, no client JS, print-friendly.** The 404/expired state is `not-found.tsx` in the same route — same Paper field + quiet footer. **Client boundary (load-bearing — no-login public):** the snapshot is the only data source; the only money is approved change-order `cost_impact_cents` (CAD); `allowance_cents`/`actual_cost_cents` exist in the snapshot type but are NEVER rendered; no supplier *cost* / markup / margin / internal notes; ✦/Henry invisible (the summary renders as plain prose). The route uses the admin client by slug only — never `getCurrentTenant()`.

**Dual-pay zone** (`src/components/features/invoices/invoice-pay-zone.tsx`): Stripe card + **Interac e-Transfer at true parity** — Interac is a structured, one-tap-copyable block (recipient · amount · memo), never free text. Mobile gets a sticky 44px+ Pay bar (card only; e-Transfer customers use the copyable block).

**Code-keyed public URLs:** the invoice public route resolves by `invoices.code` first, then falls back to raw `id` (legacy links keep working). New sends generate the code (`generateInvoiceCode` in `src/server/actions/invoices.ts`) and key the visible doc number (`INV-XXXXXXXX`) + pay URL on it — never echo the raw row id on a no-login PII page. Migration `20260523194840_invoices_public_code.sql` (additive column + backfill + partial unique index).

## 29. Change-order diff-action palette (edit-action types ≠ lifecycle status)

A change order carries two **separate** colour systems — don't conflate them:

- **Lifecycle status** (draft / pending / approved / declined / voided) → `status-tokens.ts` `changeOrderStatusTone` (§7). Answers "what state is this CO in".
- **Diff-action** (add / change / remove / budget) → `src/lib/ui/change-order-action.ts` `changeOrderActionStyle`. Answers "what KIND of edit is this row". A green *add* row is NOT a "success" status; a red *remove* row is NOT a "declined" status.

One intentional tone per action, **label + glyph paired** (never colour-only, WCAG SC 1.4.1): `add` emerald `+`, `modify`→**Change** blue `↔`, `remove` red `−`, `modify_envelope`→**Budget** muted `□`. Maps the `change_order_lines.action` enum.

Render the pill via `<ChangeOrderActionChip action=… [count=…] />` (`src/components/features/change-orders/change-order-action-chip.tsx`) — `count` makes a summary chip ("3 Added"). Row washes + signed-Δ tint come from the same `changeOrderActionStyle[action].rowClass` / `.deltaClass`. Used **identically** in the operator editor (`change-order-diff-form.tsx`) and the customer-facing diff view (`change-order-diff-view.tsx`) so the eye is trained once. Before/After/Δ figures: `changeOrderLineDelta(line)` (handles `modify_envelope` reading `before_snapshot.estimate_cents` and `remove`→0 after).

**Operator margin read** (editor only): the sticky impact bar shows `Margin on change · X%` vs the project mgmt-fee floor, tagged `OPS`. Hard boundary — this and any cost/markup figure **never** render on a customer surface (public `/approve`, send preview, portal); the customer doc is price-only (§28).

## 30. Config-fold disclosure (collapse secondary config into one "details" section)

When a screen's main task is one thing but several **config / setup** affordances also need to live on the page, don't stack them as sibling banners under the primary content — fold them into a single titled disclosure so the hero stays the hero. `InvoiceDocumentDetails` (`src/components/features/invoices/invoice-document-details.tsx`) is the first instance: it wraps the tenant-defaults setup nudge + the per-invoice payment-instructions/terms/policies overrides editor (both passed as `children`, so the disclosure owns only the fold chrome — no duplicated form logic).

- **One collapse, not N banners.** Children that previously each carried their own card/banner frame get *de-chromed* (the overrides editor dropped its own `Card` + inner collapse; the defaults nudge became a thin warn-soft caution) so they read as fields inside the section, not nested cards.
- **`needsAttention` opens it on first paint** only when something is actionable (a blank tenant default, or an active override) — otherwise it's collapsed with a calm `statusLabel` ("Using tenant defaults") + a green dot. Don't auto-open for the calm case.
- Built on the shared `Collapsible` primitive (`src/components/ui/collapsible.tsx`); chevron rotates 90° on open.

Reach for this whenever a detail page sprouts a third+ secondary banner — the candidates are "config, not the main task" (terms, defaults, integrations, notification prefs).

## 31. Selection allowance-vs-actual variance (+ dual-authoring tag + over-allowance CO nudge)

Per-room finish selections carry `allowance_cents` (the contractual budget) + `actual_cost_cents` (what the choice cost). Three primitives surface that, shared between the operator Selections tab and the client portal so they can't drift:

- **Variance logic** — `src/lib/selections/variance.ts` (pure, unit-tested in `tests/unit/selections-variance.test.ts`). `selectionVariance(allowance, actual)` returns a `{ tone, label, deltaCents, isOverAllowance }` with a verb-bearing label for every case (over / under / on-allowance / allowance-only "no actual yet" / actual-only). `rollupVariance(items, 'Room'|'Project')` nets only selections with a comparable allowance+actual pair (a TBD actual must NOT read as "under") and reports `overCount`.
- **Rendering** — `src/components/features/portal/selection-variance-ui.tsx`. `<VarianceDelta tone label />` is the soft-pair pill (over = rose, under = emerald, flat/pending = muted — the §7 status-token palette), glyph + label, **never colour-only**. `<ByTag createdBy promoted selfLabel />` is the dual-authoring tag: Operator-spec (shield) / By client|you (user) / Promoted from idea (sparkles). Promotion wins over `created_by`.
- **Henry over-allowance nudge** — `src/components/features/portal/over-allowance-nudge.tsx`. Deterministic from allowance vs actual (no model call), labeled `Henry ✦`, dismissible (local), names the over items + overage, links a single prefilled "Draft Change Order". **Operator-only — never on the portal.**

**"Start CO" wiring**: over-allowance rows + the nudge link to the real CO creation route `/projects/[id]/change-orders/new?from=selection&title=…&reason=…`. The page (`new/page.tsx`) reads those params into `mode={{ kind:'create', prefill }}` on `ChangeOrderDiffForm`, which seeds the title + reason. Lines stay empty — the operator authors cost impact + approves. Henry never auto-creates.

**CLIENT BOUNDARY** (enforced in `portal-selections.tsx` + `portal-selections-panel.tsx`): the client sees allowance vs **their** actual + room roll-up, but **never** margin / markup / supplier / SKU, and **no Start-CO**. `project_idea_board_items` and `project_selections` stay **distinct objects** — ideas promote one-way into selections (Object Model `b4d880be`); the promoted tag is derived from `idea.promoted_to_selection_id`, the tables are never merged.

Sibling instances: operator `selection-list.tsx`; portal read-only `portal-selections.tsx`; portal composer `portal-selections-panel.tsx`. OD source: `od-selections/screens/{desktop,mobile}.html`.

## 32. Public brand header (`<PublicBrandHeader>` — the GC letterhead bar)

The brand-chrome counterpart to `<CustomerDocument>` (§28) for the **non-money** public surfaces — the **Portal hub** and **Tap-to-decide** — that are not document-shaped enough to render *inside* CustomerDocument but still must open with the GC's letterhead, never HeyHenry's. A white `bg-card` bar floating on the warm Paper `bg-background`: signed GC logo (or two-letter text fallback) + business name + an optional context line + a quiet "secure" lock (the no-login trust signal).

`src/components/features/public/public-brand-header.tsx`. Props: `logoUrl` (signed from the private `photos` bucket — brand chrome, not project data), `businessName` (doubles as logo alt), `context` (caller-supplied — project name + client first name, or "A quick decision for {name}"; **never a money / internal figure**), `hideSecure`.

**Hard boundary:** renders no project data beyond the business name + the caller's `context` string — it never sees cost / margin / supplier / unit fields. The money documents (Estimate / CO / Invoice) keep using `<CustomerDocument>`'s own letterhead; this is only for the brand-header + artifact + action shape where the artifact isn't a priced doc.

**Adopters:**
- `src/app/(public)/portal/[slug]/page.tsx` — Portal hub. Sits in a rounded `bg-card` card over `bg-background`; the project hero (name + status + % complete) renders under it. Mobile gets a fixed bottom-sheet tab bar (`sm:hidden`, pure `<Link>`s, no client JS) mirroring the thumb-reachable primaries (Project/Schedule/Photos/Messages + More→Budget); the full 7-tab strip stays scrollable up top so every tab is reachable. Project-tab order: decisions pinned → status/progress → approvals → phases → docs → trades → updates → a **calm** boundary note (`Shield` glyph) that does NOT enumerate withheld categories (enumerating internal costs/supplier pricing spotlights markup — a margin tell).
- `src/app/(public)/decide/[code]/page.tsx` — Tap-to-decide. Brand header → `DecisionPanel` artifact → one-question boundary note. Terminal/decided/dismissed states render in the same branded `Shell`.

OD source: `od-public-pages/screens/{desktop,mobile}.html` (`gc-bar` recipe). Mobile is primary.

## 33. Drag-to-reorder server sections with per-user persisted order

When a server-rendered surface (the owner dashboard) needs user-reorderable blocks **without** turning the blocks themselves into client components: render each block server-side, pass them to a thin `'use client'` sortable wrapper as a `key → node` map, and let the wrapper own only the *order*.

**Canonical instance** — owner dashboard sections:
- `src/components/features/dashboard/dashboard-sections.tsx` — dnd-kit `DndContext` + `SortableContext` (`verticalListSortingStrategy`), `PointerSensor` (6px activation) + `KeyboardSensor`. Optimistic local order; reverts + toasts on failed save. Drag handle is a hover-revealed grip (`opacity-0 group-hover:opacity-100`, `focus-visible:opacity-100` for keyboard) pinned `absolute right-2 top-2`.
- `src/lib/dashboard/sections.ts` — **stable string keys** + `normalizeSectionOrder()`: filters unknown/stale keys and appends missing ones in default order, so a saved order never breaks when sections are added/removed. Keys are permanent — renaming one orphans saved orders.
- `src/server/actions/dashboard-preferences.ts` — `{ ok, error }` discriminant; re-normalizes the client payload server-side before persisting (never trust the client to send the full/clean key set).
- Persistence: `tenant_members.dashboard_section_order text[]` (per-user, per-tenant; `NULL` = default). Self-update RLS already covered by `tenant_members_update_self` (mig 0152). Read via `getDashboardSectionOrder(userId)` in `src/lib/db/queries/dashboard.ts`.

**Shared expectations for this family:** server blocks stay server components (passed as children/props — Suspense boundaries move *inside* the map values); the wrapper is the only client component; order is the only client-owned state; saves are optimistic with revert-on-failure; the stored value is always normalized to the current key set on both read and write. Reuse this shape for any future "let the user arrange these blocks" surface rather than lifting the blocks into client land.

## 34. Resumable step shell + selection tiles (first-run onboarding)

A **skippable, resumable** one-step-per-screen flow inside the `(auth)` shell, where *value is never gated on completeness* — every step has Skip + Back and the final hand-off always reaches the destination.

**Canonical instance** — the first-run setup pass (`/onboarding`):
- `src/components/features/onboarding/onboarding-flow.tsx` — the client shell. Owns step index + an ink (not rust) segmented progress bar (`role="progressbar"` + `aria-valuenow/min/max`). `goTo()` fire-and-forgets `setOnboardingStepAction(step)` so the **resume marker never blocks the UI**; the marker is monotonic (advance-only via a `.lt('onboarding_step', step)` guard) so Back-then-leave doesn't lose progress. Exports a shared `StepActions` footer (ink primary CTA + low-emphasis "Skip for now").
- Step bodies: `vertical-step.tsx` (selection tiles), `profile-step.tsx` (reuses `LogoUploader` + the shared `updateBusinessProfileAction`, passing through Settings-managed fields so they aren't clobbered), `meet-henry-step.tsx` (orientation card, **not** a chat box).
- `src/server/actions/onboarding.ts` — `{ ok, error }` actions; `completeOnboardingAction` stamps `tenants.onboarding_completed_at` (idempotent via `.is(..., null)`); a failed save **never** stops the hand-off (the shell still routes to `/dashboard`).
- Route guard: `src/app/(auth)/onboarding/page.tsx` reads the marker — `onboarding_completed_at` set → `redirect('/dashboard')` (loop-safe); else resume to the clamped furthest step. Marker columns added in `20260524040346_onboarding_progress_marker.sql` with existing tenants backfilled to "complete" so they never re-onboard.

**Selection tile** (the `vertical-step` tiles): a keyboard-accessible `<button aria-pressed>` card (mobile ≥44px target) carrying the screen's **one rust accent** on the selected state only — `border-brand ring-3 ring-brand/15` + a `bg-brand` radio check. The CTA stays ink. Pattern mirrors `plan-picker.tsx`'s `PlanCard` (`role="button"`-style card) but uses a real `<button>` + `aria-pressed` for a single-select radio group. Reuse this for any "pick one of N options" tile group; reuse the step-shell shape for any future skippable multi-step setup.
