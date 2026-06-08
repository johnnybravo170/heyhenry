# OD Brief — Public pages (the no-login, client-facing surfaces: Portal + approvals)

> **Grounded in:** the `src/app/(public)/*` route group — **Portal** `/portal/[slug]/page.tsx` (+ 27 components in `src/components/features/portal/`), **approvals/decisions** `/estimate/[code]` (GC estimate → `EstimateRender` + `approval-form`), `/approve/[code]` (change order), `/decide/[code]` (tap-to-decide `project_decisions`), `/view/invoice/[id]` (pay invoice), `/view/[id]` (PW quote — see `quotes.md`), **read-only** `/pulse/[code]` (`pulse_updates`), `/home-record/[slug]` (frozen handoff snapshot, server-only no-JS), `/showcase/[slug]` (public past-projects), **growth** `/q/[slug]` (lead-gen `PublicQuoteForm`), `/r/[code]` (referral), **static** `/privacy` `/terms` `/security` `/refund-policy`. All use `createAdminClient()` (no auth) + slug/`approval_code` access; logos signed from the private `photos` bucket; pages set `robots noindex`. Data: `projects` (`estimate_status` ∈ draft|pending_approval|approved|declined; `estimate_approval_code`; **`customer_view_mode`** ∈ detailed|summary; `customer_summary_md`; `terms_text`; `document_type`), `change_orders`/`project_decisions` (`approval_code`), `invoices`, `pulse_updates` (`public_code`, payload), `home_records` (frozen JSONB snapshot + `slug`/`pdf_path`/`zip_path`), `customers`, `tenants` (logo/`gst_number`/`wcb_number`). Tax via `canadianTax.getCustomerFacingContext` (tax-exempt aware). Vault: **Customer Portal module `c3e78671`** (current tab structure + conventions), **Home-Record product framework `af12ea51`** (the closeout vision), Role × Object Matrix `03b1ccf4` (**the homeowner/portal boundary — hard rules**), Object Model `b4d880be`, Positioning `5bfa59be`. Siblings: **`client.md`** (the *operator-side* project Client tab — configures what the portal shows), `quotes.md` (`/view/[id]`), `invoices.md` (`/view/invoice`), `project-secondary-tabs.md` (Home Record generation), `schedule.md` (the portal's read-only Gantt).
> **How to use:** these are **mobile-first, brand-carrying** surfaces — render phone-first with a **tenant logo + Paper palette**. The highest-value OD output is **one shared "public surface" template** (header/brand · body · action) reused across the approval family + portal shell. Generate: the Portal hub, the estimate-approval page, and a tap-to-decide page; then run `heyhenry-design-critique` at mobile width.
>
> **Governing principle — these carry the GC's brand to their client; the boundary is sacred; no login walls.** Three rules: (1) **One calm, branded, no-login template** — every public surface opens with the GC's logo + name, never HeyHenry's, and needs no account (slug or `approval_code`); per HeyHenry UX principles, *no login walls for customers*. (2) **The client boundary is absolute** (Role Matrix hard rules): never expose internal cost, supplier pricing, **margin/markup**, other customers/projects, internal worklog/notes, unshared photos (default `internal`), or non-`client_visible` docs. (3) **Preview before send** — the GC always previews the customer view before anything goes out; Henry drafts (Pulse), the GC approves.
>
> **Current vs target:** the whole family is built and live — portal hub (11 tabs), the approval pages, Pulse, Home Record, showcase. **Target (the deltas):** (1) **unify the visual template** — today these surfaces drift (the PW quote `/view/[id]` is plain gray; the estimate uses `EstimateRender`; the portal has its own chrome) — bring them to **one branded Paper template**; (2) **mobile-first hardening** — clients open these on a phone from an SMS/email link; (3) **the `customer_view_mode` (detailed ↔ summary) control** is the key margin-protection lever — make it a first-class GC choice; (4) terminology — code/docs say "homeowner" everywhere; the client-facing copy must say **"client"** (or the GC's own customer's name), never "homeowner." **Flagged** throughout.

**Object:** the **shared customer artifact** — an estimate, change order, decision, invoice, progress update, or the portal itself — rendered for the client. · **Roles:** **client / public only** (no account; slug or `approval_code`). The operator authors these on the dashboard side (`client.md`, the project tabs). · **Primary action (client):** understand what's happening or what's being asked, and **approve / pay / decide in one tap** — no friction, no login.

## Purpose
The customer half of the product. Where the dashboard is the GC's cockpit, these pages are **what the GC's client actually sees** — the proposal they approve, the change they sign off, the invoice they pay, the progress they follow, and the permanent record they keep. They are the brand surface: calm, professional, "Linear-not-Buildertrend," and they must never leak the internals that would erode trust (markup, other jobs, raw costs).

## The family map *(group + unify)*
| Surface | Route | What the client does | Group |
|---|---|---|---|
| **Customer Portal** | `/portal/[slug]` | Follow the whole project (progress, photos, decisions, money, messages) | **Hub** |
| **Estimate approval** | `/estimate/[code]` | Review + **approve/decline** the GC estimate (line-item or summary) | **Approve** |
| **Change Order approval** | `/approve/[code]` | Approve/decline a CO (cost + schedule impact + photos) | **Approve** |
| **Tap-to-decide** | `/decide/[code]` | Approve/Decline/Ask a decision from an SMS/email link | **Approve** |
| **Invoice pay** | `/view/invoice/[id]` | View + **pay** an invoice (Stripe / e-Transfer) | **Approve** |
| **PW quote** | `/view/[id]` | Approve/decline a pressure-washing estimate (`quotes.md`) | **Approve** |
| **Project Pulse** | `/pulse/[code]` | Read a Henry-drafted, GC-approved progress snapshot | **Read-only** |
| **Home Record** | `/home-record/[slug]` | Keep the permanent closeout package (no-JS, shareable) | **Read-only** |
| **Showcase** | `/showcase/[slug]` | See the GC's past projects (portfolio/marketing) | **Read-only** |
| **Quote request** | `/q/[slug]` | Request a quote (lead-gen → intake) | **Growth** |
| **Referral** | `/r/[code]` | Land from a referral link | **Growth** |
| **Legal** | `/privacy` `/terms` `/security` `/refund-policy` | Static | **out of redesign scope** |

## The Portal hub `/portal/[slug]` *(the big one — per module `c3e78671`)*
- **No-login, slug-based** (resolved via `src/lib/portal/slug.ts`; public RLS is the safety boundary; pages must NOT call `getCurrentTenant()`). **Tab-gated data loading** (each tab loads only what it renders — don't hoist).
- **Order is intentional** (keep): money block (contract total + payments) → budget → pending approvals → phases → schedule → photos → decisions → docs → ideas/selections → messages.
- **Tabs:** Schedule (read-only Gantt, firm bars only, mobile sticky-name column — `schedule.md`) · Budget (per-category detail gated by `show_portal_budget`) · Photos (client-visible only) · Updates (chronological, incl. system schedule breadcrumbs) · Phases (milestone rail) · Decisions (pending queue) · Selections (operator + customer-authored) · Idea board (customer-posted) · Documents (`client_visible` only) · Trades · Messages (two-way thread).
- **Customer-facing only:** firm Gantt bars (no confidence dimension), high-disruption tasks shown amber, **never** a raw contractor Gantt or any cost internal.

## The approval family — one template, one pattern
All approval pages share a shape: **GC brand header → the artifact (rendered for the client) → the action**. Unify them:
- **Estimate** (`/estimate/[code]`): `EstimateRender` with logo, customer, cost lines grouped by **category** (not "bucket"), transparent **management fee** line, GST (tax-exempt aware), GST/WCB numbers, `terms_text`. **`customer_view_mode`**: *detailed* (line items) vs *summary* (`customer_summary_md` — the margin-protecting simplified view). Approval form when `pending_approval`; approved/declined states otherwise.
- **Change Order** (`/approve/[code]`): what changed · why · **cost + schedule impact** · photo proof · approve/decline (the locked convention: approved CO updates budget + schedule, does **not** auto-bill).
- **Decision** (`/decide/[code]`): the **CO-urgency-via-SMS gap-filler** — tap a phone link → decision context + reference photos → Approve / Decline / Ask, no login, no portal navigation. Mirrors the portal's decision queue.
- **Invoice** (`/view/invoice/[id]`): line items + total + **pay** (Stripe + Interac e-Transfer at parity).
- **Shared rules:** every approval emits requested-at/channel/target/expiry; state is visible on the parent object; the approver is the client via `approval_code` (same pattern as internal approvals).

## Read-only progress + handoff
- **Project Pulse** (`/pulse/[code]`): Henry-drafted, **GC-approved** progress page (completed / in-progress / waiting-on-you / up-next / ETA). The "calm weekly update" — Henry writes, the GC previews+approves, the client reads. (`[[henry-intelligence-not-chat]]` — this is Henry *output*, not a chat.)
- **Home Record** (`/home-record/[slug]`): the **frozen** closeout package (server-only, no JS) — header/phases/decisions/COs/selections/photos/documents from a JSONB snapshot. Permanent, shareable to spouse/realtor/insurer/future contractor. The "portal becomes Home Record at closeout" payoff (`af12ea51`); generated from the Documents tab (`project-secondary-tabs.md`).
- **Showcase** (`/showcase/[slug]`): the GC's public past-projects portfolio (favorite/`showcase_score` photos) — a marketing surface, not project-scoped.

## Progressive disclosure
- **Snapshot:** each surface opens on the one thing — "here's your estimate / what we need you to approve / where the project is."
- **Operational:** approve / decline / pay / ask — the single primary action, big and obvious.
- **Detail:** line items, photo proof, the full portal tabs.
- **Audit:** the client sees their own history (decisions made, invoices paid); the operator holds the full record.

## Henry intelligence touchpoints *(GC previews everything client-facing)*
- **Pulse drafting** — Henry composes the progress update; the GC approves before it's visible. Never auto-published.
- **Summary view** (`customer_view_mode='summary'` + `customer_summary_md`) — a simplified, margin-protecting estimate framing; Henry can draft the summary, GC approves.
- **Tap-to-decide nudges** — the `/decide` link is sent via SMS/email so decisions don't rot in a portal nobody logs into (the confirmed competitor gap). Henry drafts the message; **outbound to the client is always human-in-the-loop.**

## The client boundary — hard rules *(the most important section)*
The public surfaces must **never** expose: internal costs, supplier pricing, **margin/markup**, other customers, other projects, internal worklog/notes, unshared photos (default `portal_visibility='internal'`), or non-`client_visible` documents. New columns surfaced on the portal need a public RLS update. The `customer_view_mode='summary'` exists precisely so a GC can show a clean total without the cost breakdown. **A leak here is the worst-case trust failure** — design every public surface assuming the client forwards the link to a competitor.

## Role variations
- **Client / public:** the only role here. No account; slug or `approval_code`. Sees only their own project's shared artifacts.
- **Operator (owner/admin/member):** never *on* these pages — they author the content on the dashboard (`client.md`, the project tabs) and **preview** the client view before sending.
- *(No "homeowner" — use "client" or the customer's own name throughout.)*

## Mobile vs desktop
**Mobile-first, always.** Clients open these from a phone via an SMS/email link: ≥44px approve/pay buttons, no pinch-zoom on tables, the portal Gantt uses `minmax()` cells + horizontal scroll + sticky name column (already built — don't regress). Desktop is the spouse/realtor reading the Home Record — keep it legible, not dense.

## Financial / Canadian
- **CAD, GST/HST** shown (tax-exempt aware via `canadianTax.getCustomerFacingContext`); **GST/WCB numbers** on estimates/invoices (Canadian trust signals); transparent **management fee** line (not baked into totals).
- **Pay:** Stripe **+ Interac e-Transfer at parity** (Canadian clients expect e-Transfer). **No holdback.**
- The estimate's `customer_view_mode` controls how much financial detail the client sees — a deliberate GC lever.

## States
- **Empty / not-found:** every code-based page has a clean "link expired or reset" state (built) — keep it calm + branded, never a stack trace.
- **Already-acted:** approved/declined/paid confirmation states (built) — "your contractor will be in touch."
- **Loading:** portal is tab-gated; approval pages are server-rendered (fast).
- **Error:** payment failures need a clear retry; approval double-submit guarded (status check).
- **Expired:** estimates/quotes show a validity-expired state with a "contact us."

## Subscreen inventory *(the public family is itself the inventory)*
- **Portal tabs** (Schedule/Budget/Photos/Updates/Phases/Decisions/Selections/Idea board/Documents/Trades/Messages) — **each MEDIUM**; several mirror briefed operator surfaces (Schedule→`schedule.md`, Photos/Docs→`project-secondary-tabs.md`, Budget→`client.md`). Spec the **client-facing render** of each; don't re-spec the operator side.
- **Estimate approval** (`/estimate/[code]` + `approval-form`) — **HEAVY → own render** (it's the GC "quote" client surface; quotes.md defers here). Includes the detailed↔summary toggle.
- **Change Order / Decision / Invoice approval** — **HEAVY → one shared approval render** (brand header + artifact + action), parameterized per type.
- **Project Pulse** (`/pulse/[code]`) — **MEDIUM → own render** (the calm update template).
- **Home Record** (`/home-record/[slug]`) — **HEAVY → own render**; the permanent no-JS handoff document (pairs with the Home-Record generate flow in `project-secondary-tabs.md`).
- **Showcase** (`/showcase/[slug]`) — **MEDIUM**; portfolio/marketing — lower priority, different audience (prospects, not clients).
- **Quote request `/q` + Referral `/r`** — **MEDIUM → growth surfaces**; spec with intake/lead-gen, not the client-project family.
- **Legal pages** — **out of scope** (static).

## Accessibility
WCAG 2.2 AA for **non-technical clients on phones**: high contrast (don't lean on subtle Paper tints for critical info); approve/pay/decline are large, clearly-labeled buttons (not icon-only); status never colour-only; the portal Gantt + tables are keyboard + screen-reader navigable with real semantics; the no-JS Home Record is inherently accessible — keep it that way; logo alt text = the GC's name.

## Decisions / Open questions
1. **Unify the public template** (the headline) — one branded Paper "public surface" shell (logo header + body + action) reused across the approval family + portal + Pulse, replacing today's per-page drift (esp. the plain-gray `/view/[id]`). Confirm OD builds the shared template first.
2. **`customer_view_mode` default** — detailed vs summary as the GC's default; per-estimate override. A positioning call (transparency vs margin protection) — confirm with the owner.
3. **Portal ↔ `client.md` boundary** — `client.md` is the operator's *config* of the portal; this brief is the *client-facing render*. Keep the line clean so the two lanes don't double-spec the same tabs.
4. **Tap-to-decide (`/decide`) cadence** — SMS/email send is the gap-filler for ignored portal approvals; coordinate the send cadence with the owner (don't spam). Outbound always human-in-the-loop.
5. **Terminology** — "homeowner" → **"client"** across all public copy (`[[feedback_client_not_homeowner]]`); "bucket" → **category** in the estimate render.
