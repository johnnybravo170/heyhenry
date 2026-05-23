# OD Brief — Change Order (the contract amendment)

> **Grounded in:** `src/components/features/change-orders/change-order-diff-form.tsx` (the v2 line-diff editor, ~1264 lines), `change-order-form.tsx` (legacy v1 even-distribute), `change-order-detail.tsx` (preview + send + manual override + realtime), `change-order-list.tsx` + `src/app/(dashboard)/change-orders/page.tsx` (standalone list), `change-orders-tab-server.tsx` (**orphaned dead code** post tab-fold), `applied-co-banner.tsx`, `change-order-diff-view.tsx` (public Before/After/Delta table), routes `projects/[id]/change-orders/{new,[coId],[coId]/edit}/page.tsx`, public `src/app/(public)/approve/[code]/page.tsx` + `approval-form.tsx`; actions `change-orders.ts` (`createChangeOrderV2Action:308`, `updateChangeOrderV2Action:474`, `sendChangeOrderAction:776`, `approveChangeOrderAction:930`, `declineChangeOrderAction:1063`, `createChangeOrderFromUnsentDiffAction:410`, `applyV2ChangeOrderDiff:55`), the text-only Henry tool `tools/change-orders.ts:65`; `lib/ui/status-tokens.ts` (`changeOrderStatusTone:155`); email `changeOrderApprovalEmailHtml`; migration `0032`. Vault: Workflow Library `e0263cc3` (CO workflow), Object Model `b4d880be`, Project Hub Spec `6c0de27d`, `docs/ux/sacred-path-map.md`. **Reconciled 2026-05-22 against vault current-state: Module: change-orders `00f93790` (auto:doc-writer evergreen) + Module: Project Budget tab `9ed92291`.** Siblings: **`briefs/estimate.md`** (a CO is a "mini-estimate" — ~90% shared code/feel), **`briefs/project-hub.md`** (the scope-diff→CO entry, CO chips + applied banner, the per-project CO wayfinding), **`briefs/invoices.md`** (approved COs become billable).
> **How to use:** paste into the OD project (HeyHenry "Paper" palette — deepened + the clarity discipline in DESIGN.md), generate hi-fi desktop + mobile, then run `heyhenry-design-critique`.
>
> **A CO is a mini-estimate.** It uses the same line/category/markup vocabulary, the same price-only customer document, and the same typed-name approval as `estimate.md` — but in **diff mode** against the *signed* scope. Design it as a focused amendment of the estimate, not a separate app. ~90% shared code with quotes (Project Hub Spec).
>
> **Current vs target:** the CO flow is **built and capable** — a v2 **line-diff editor** against the signed scope (inline qty/price edits, strikethrough-remove, +add line, per-category envelope, inline new categories, a sticky **live total delta**), auto-derived cost impact + manual timeline impact + a per-CO management-fee override (reason required), a **price-only public approval** with a Before/After/Delta diff view + typed-name e-signature, email **+ SMS** send, realtime status, manual override, and a **scope-diff→CO** materializer. Target deltas — **workflow first** (Henry/voice is an easy layer on top, not the foundation): (1) make the **diff legible** — what's changing vs the *signed* scope, Before→After→Δ, with an operator-only margin read; (2) a **customer-facing plain-English "why" explanation** (today the homeowner sees a raw description on a price increase); (3) **per-project CO wayfinding** (the in-hub CO tab is orphaned — "all COs on this job" isn't in the hub); (4) a **send preview** (reuse the estimate send-bar); (5) Paper + three-type-sizes + intentional diff-action colours; (6) the **approved-but-unbilled CO** nudge. **Then**, once that manual flow is solid, the easy accelerator: **voice/photo CO drafting** (currently unbuilt — the Henry tool is text-only → legacy v1). **Flagged** where target differs.

**Object:** Change Order (`change_orders` + `change_order_lines`) — a priced amendment to the signed estimate · **Roles:** owner / admin / member (author + send); homeowner (approve / decline, public) · **Primary action:** capture a scope change → get it approved → it updates the budget (and becomes billable).

## Purpose
**Keep the contract honest as the job changes.** Every reno changes — rotten subfloor behind the wall, the customer upgrades the tile, an extra outlet. The CO is how a change gets **priced, explained, agreed, and folded into the budget** without eroding margin or losing the paper trail. It protects the GC's money *and* the customer relationship: no surprise invoices, no "but you said." It's the discipline that makes the post-approval project trustworthy (the Hub's scope-diff routes here).

## The data truth this screen must reflect
- **`change_orders`** status `draft → pending_approval → approved | declined | voided`. **`flow_version` 2** (line-diff) is the default and the GC story; **v1** (even-distribute dollar allocation) is a legacy escape hatch (`?v2=0`) — design v2; treat v1 as deprecated.
- **`change_order_lines`** carry an `action` ∈ **add | modify | remove | modify_envelope** — the diff against the project's *current* `project_cost_lines` / `project_budget_categories`.
- **On approval, `applyV2ChangeOrderDiff` mutates the budget** (add/modify/remove lines, bump envelopes) **and snapshots a new scope baseline** — the contract **version increments**. Idempotent on `applied_at`. **It does NOT auto-bill** (locked convention) — the approved CO becomes available to include in a later draw/final invoice.
- **Cost impact is auto-derived** from the line deltas (no manual field); **timeline impact** (`timeline_impact_days`) is a manual integer; a **per-CO management-fee override** (%) is allowed with a **required reason**.
- **The customer sees PRICE only** — `line_price_cents` + the fee % + the running new-vs-was project total. Never `unit_cost_cents` / `markup_pct`. (Same boundary as the estimate.)
- **Public page is `approval_code`-keyed** (`/approve/[code]`) — already on the good pattern, consistent with `/estimate/[code]` (the invoice public page is the id-keyed outlier the map flags).
- **Reconciliation (2026-05-22, vault Module: change-orders `00f93790`):** the `action` enum `add | modify | remove | modify_envelope` is **code-verified** (`db/queries/change-orders.ts`) — keep it. `applied_at` (mig `0155`) is the *only* "applied" signal — don't infer from another column. **`percent_complete` is invoice-side (mig `0156`), NOT on COs** — do not surface a %-complete field on the CO. The customer-facing breakdown field is **`affected_categories`** (mig `0171`). Customer SMS approval is owned by the messaging pipeline (`src/lib/messaging/`), not the CO module.

## Layout — the CO editor (diff mode)
The v2 editor (`change-order-diff-form.tsx`) shows the **current signed scope** (sections → categories → lines) and lets the operator amend it: inline-edit qty/price, **strikethrough-remove**, **+ Add line** per category, a per-category **envelope** input (disabled when lines are edited, to avoid double-count), and inline new categories/sections. A **sticky header carries the live total delta** (±$). Metadata: title, description, optional reason, **timeline impact (days)**, per-CO **mgmt-fee override** (reason-on-change). Keep all of this — restyle and clarify:
- **Make the diff legible.** The whole screen is "what's changing vs the contract." Lead with **changed rows**; show each as **Before → After → Δ**. Today the add/modify/remove/envelope rows use ad-hoc emerald/rose/amber/blue tints — **make the diff-action colour system intentional + consistent** with the public `ChangeOrderDiffView` (one add tone, one remove tone, one modify tone — sourced from tokens, paired with a label/glyph, not raw Tailwind hues). This is a deliberate semantic palette *separate from* lifecycle status (which stays on `status-tokens.ts`).
- **Three type sizes, Paper, money discipline** (tabular-nums, de-emph cents, right-aligned) — same cleanup as the estimate table.
- **Operator-only margin read** on the delta (cost vs price of the change) — the GC must see whether the CO holds margin; the customer never does.
- **Inline new categories persist immediately** (current quirk) — flag whether that should stage until save (consistency with a draft CO).

## Henry intelligence — *workflow first; voice is an easy layer on top*
**Priority: make the manual CO workflow excellent on its own.** The screen has to be great when the GC types the change by hand — a fast, legible diff against the signed scope, a clear customer "why," a clean approval. The design must **never depend on Henry**; Henry then **layers on as an accelerator**, not the organizing principle.
- **Voice/photo drafting — an easy add, sequence it *after* the flow is right** *(currently unbuilt — `create_change_order` is text-only → legacy v1).* Once the manual v2 flow is solid, voice is cheap to drop on and pre-fills **the exact same form** the operator already knows: on site the GC speaks + snaps — *"Found rot under the bathroom subfloor — new sheet of ply, extra half-day, about eighteen hundred"* + 3 photos — and Henry pre-fills the v2 CO (line diff, +0.5d timeline, a draft "why," photos attached). Review + send is unchanged. Henry **drafts**, the operator **sends** — never auto-send. Reuse the estimate's voice plumbing (`useHenryForm`), routed to the **v2** action.
- **Smaller assists that ride the workflow:** a **draft of the customer "why"** from the diff; the **approved-but-unbilled CO nudge** *(target)* — approval updates the budget but doesn't bill, so approved COs can silently go unbilled (a revenue leak flagged in the map); Henry surfaces *"$X in approved change orders not yet billed — add to the next draw?"* (peach, in the Hub Overview + Customer Billing), decision-attached, one-tap.
- **Henry-prompt chrome** where Henry appears: ✦ HENRY + rust left-border + rust action; **fill reflects meaning** (peach = draft-ready / ready-to-bill, warn-soft = margin caution, never danger-red on a positive).

## The customer-facing explanation *(target)*
Today the homeowner sees the raw `description` + per-line/category notes. A change order is a **trust moment** — the customer is being asked to pay more, so they need to understand **why** in plain language. **Target:** a dedicated, prominent **"What's changing & why"** explanation on the customer doc (Henry can draft it from the diff + the voice note), above the Before/After/Delta table. Keep the notes as line-level detail.

## Send & approval hand-off
- **Send** (`sendChangeOrderAction`): flips → pending_approval, sends **email + SMS** (≤160-char plain-language with the `/approve/{code}` link), posts a portal update + worklog. Today there's **no preview of what the customer receives** and the **approval link isn't surfaced** for manual copy. **Target:** a **send preview** that reuses the estimate `EstimatePreviewSendBar` pattern — recipient(s), optional personal note, the rendered customer doc, and a **copyable approval link** (for texting it themselves). Make "email + SMS both go out" legible.
- **Public approval** (`/approve/[code]`): keep — it's strong. Business/project header, the **"why" explanation**, a **price-only impact card** (Total Cost Impact, new-vs-was running total, fee breakdown: Cost of work / Management fee X% / Total), the **`ChangeOrderDiffView`** Before/After/Delta table + per-category notes, and a 3-state form (pending → approve/decline → done). **Approve = typed-name e-signature**; **decline takes an optional reason**. Restyle to match the estimate public surface (one consistent customer document system). **No cost/markup leak** — keep.
  - **Consistency flag:** the **estimate** public page has **no decline button** (feedback-only, to keep the GC in the conversation), but the **CO** page **does** decline. Decide the intended stance (a CO is arguably a cleaner discrete yes/no on a priced change, so decline may be right here) — but make it a *decision*, not an accident. Open question below.
- **Manual override** (`ManualApprovalDialog`): record a verbal/text/in-person approval — keep (same first-class manual path as the estimate; reno COs often get an on-the-spot "yeah do it").
- **Realtime:** the detail page live-updates when the customer responds — keep (a nice "they just approved" moment).

## Wayfinding — where COs live *(target — fix the orphan)*
A real per-project picture is missing: the in-hub "Change Orders" tab folded into Budget and **`ChangeOrdersTabServer` is now orphaned dead code**. On the Budget tab the operator sees the `AppliedChangeOrdersBanner` + per-category **CO chips** (applied COs only); the **full list with statuses** (draft/pending/approved/declined) is reachable only via the **global `/change-orders`** route filtered by project. **Target (reconciled):** surface a **per-project "Changes" view *inside the Budget tab*** — all COs on this job, their statuses, totals, and the **+ New change order** entry — **not** a reintroduced top-level tab. This honors **decision `6790ef2b` / PR #160** (the dedicated CO tab was deliberately folded into Budget; `change-orders-tab-server.tsx` is dead; `?tab=change-orders` survives only as a route-alias and internal links **must emit `?tab=budget`** — *do not reintroduce it*) **and** the Hub's locked tab IA (Budget · Spend · Labour · Schedule · Billing · Overview + Client² · Photos · Documents — no "Changes" tab). Keep the global `/change-orders` as the cross-project roll-up. *(Source: vault Module: change-orders `00f93790`.)*
- **Entry points (keep):** the Hub scope-diff → "Create Change Order" (`createChangeOrderFromUnsentDiffAction` materializes a v2 draft from the working-vs-signed diff → lands on the CO detail as a **draft**); "+ New change order" from the project; voice/photo draft (target).

## Role variations
- **Owner / admin / member:** author + send + manual-approve + see cost/margin on the change.
- **Worker:** **N/A** for authoring/pricing — but the **voice/photo capture** that *feeds* a CO draft comes from the field (worker app / the GC's phone). The worker never sees CO pricing or margin.
- **Homeowner:** public `/approve/[code]` — view + approve/decline **their** CO only; **price-only**, the "why," the Before/After/Delta — never cost/markup, never another job.

## Mobile vs desktop
**Change capture happens on site — "mobile = doing work."** The scope changes in the moment, so the mobile flow must let the GC capture a change **fast, by hand**: pick the affected category, add/adjust a line, set price + a half-day, write a one-line why, send. That **manual** mobile flow is the priority and must stand on its own (offline-tolerant). **Voice/photo is the easy accelerator on top of it** — same form, pre-filled — never a separate or required path.
- **Desktop (refine):** the full line-diff editor — precise add/modify/remove against the signed scope, envelope tweaks, mgmt-fee override, send preview.
- Dense diff table → stacked **Before/After/Δ** cards on mobile; 44px+ targets; send/approve dialogs → bottom sheets; the "they approved" realtime toast.

## Financial / Canadian
- **CAD**, tabular-nums, de-emph cents. **GST/HST** province-aware on the customer impact card; the **management fee** (with per-CO override) is the markup line. Cost-impact auto-derived; **no holdback**; **no auto-bill** — approved COs flow to the **Customer Billing** tab to be drawn. WCB/place-name texture where relevant.

## States
- **Draft:** the diff editor; live total delta; Edit/Delete; not yet sent.
- **Pending approval (sent):** preview + "awaiting customer"; realtime; resend keeps the link; manual-override available.
- **Approved:** applied banner ("Applied to estimate" + any apply warnings — e.g. `orphaned_line`); budget updated; version incremented; **now billable** (nudge to add to a draw).
- **Declined:** declined banner + reason; can revise/clone to a new draft.
- **Voided / cancelled:** muted; clear status; no budget effect.
- **Empty (no COs on the project):** calm — "No change orders yet. When the scope changes, capture it here." + the voice/photo + manual entry paths.

## Visual identity
Deepened **Paper**; white cards on warm paper; solid hairlines; near-black ink. **Three type sizes (16/14/12)** + the ink ramp. **Lifecycle status via `status-tokens.ts`** (`changeOrderStatusTone`: draft=neutral, pending=warning, approved=success, declined/voided=danger/neutral, with icons). The **diff-action palette** (add/modify/remove/envelope) is a *separate, intentional* semantic system — one tone each, token-sourced, label+glyph paired (never color-only), used identically in the editor and the public diff view. **Rust is the single accent** (primary CTA + Henry actions). **Henry chrome** with the fill-reflects-meaning rule (peach = draft-ready / ready-to-bill, warn-soft = margin caution, never danger-red on a positive). Money right-aligned, tabular, de-emph cents.

## Subscreen inventory
Subscreens spec inline; the public approval page graduates (Public-pages menu).

**Modals / dialogs / routes**
- **Change-order editor** (`change-order-form`; route `/projects/[id]/change-orders/new`) — line items · why-explanation · photos. Create draft → optionally send.
- **CO-from-diff** (`change-order-diff-form`) — build a CO from the unsent scope diff (`createChangeOrderFromUnsentDiffAction`), entered from the Budget scope-diff review.

**Sub-flows**
- **Send CO** — generate `approval_code` → email the client → `/approve/[code]` (public approval, photo proof). Preview before send. On approval: updates Project budget + schedule; **does NOT auto-bill** (locked) — available for a later owner-initiated invoice.
- **Voice/photo CO drafting** (open dev card) — Henry drafts a CO from a voice note + photos → review (future).

**Expansion / disclosure**
- CO list + per-CO line items; status (draft / sent / approved / declined) via `status-tokens`; applied-CO contributions surface on Budget.

**Sub-routes (graduate → Public pages, `research-0523`)**
- `/approve/[code]` — public CO approval (customer-facing).

## Accessibility
WCAG 2.2 AA: near-black ink on white; **never colour-only** for diff actions or status (pair with label + glyph — the public diff view already labels Action); typed-name e-signature input labeled + required; the live total-delta announces changes; ≥44px targets on mobile capture/approve; realtime status changes announced politely.

## Open questions
- **Voice/photo CO drafting** — **sequence it after** the manual workflow is solid (it's an easy add on top, not the foundation — per direction). Reuse the estimate's voice plumbing (`useHenryForm`), routed to the **v2** action (the current Henry tool wrongly targets v1).
- **Customer decline parity** — estimate has no decline (feedback-only); CO has decline. Align, or keep CO decline as a deliberate "discrete yes/no on a priced change"? (Lean: keep CO decline; make it intentional.)
- **Per-project CO view** — *reconciled (2026-05-22):* a Changes **section inside the Budget tab** (not a reintroduced tab — honors decision `6790ef2b` + the locked tab IA; internal links keep `?tab=budget`), with the global `/change-orders` as the cross-project roll-up.
- **Inline-new-category timing** — should new categories created mid-CO stage until the CO saves (vs persist immediately as today)?
- **Approved-but-unbilled nudge** — where it lives (Hub Overview attention strip + Customer Billing) and its threshold.
- **v1 retirement** — is the legacy even-distribute flow (and the v1-only Henry tool) safe to drop for GC V1?
