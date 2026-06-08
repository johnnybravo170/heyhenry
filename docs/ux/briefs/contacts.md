# OD Brief — Contacts (directory list)

> **Grounded in:** `src/app/(dashboard)/contacts/page.tsx`, `customer-table.tsx`, `customer-search-bar.tsx`, `customer-type-badge.tsx`, `customer-empty-state.tsx`, `lib/db/schema/customers.ts`, `lib/validators/customer.ts`, `lib/db/queries/customers.ts`, migration `0113_contacts_lead_kind.sql`, `existing-matches-banner.tsx`, PATTERNS.md §7/§15/§16. **How to use:** paste into the OD project (HeyHenry "Paper" palette — deepened + the typographic-clarity discipline in DESIGN.md), generate hi-fi desktop + mobile, then run `heyhenry-design-critique`.
> **Current vs. target:** today this screen is a flat rolodex — Type · Name · Contact · Location · Added, a 200-row cap, an 8-hue kind-color rainbow, and no signal about which contacts matter right now. This brief specifies the **target** (one calm kind treatment, a job/AR signal column, pagination, list-level dedup) — **flagged** where it differs from current.

**Object:** Customer / contact (the `customers` table is the universal contact directory) · **Roles:** owner / admin / member · **Primary action:** open a contact (or New contact / Import with Henry)

## Purpose
The operator's directory of every relationship the business tracks — customers, leads, vendors, sub-trades, agents, inspectors, referral partners — with fast search/filter, one tap into any contact, and a calm read on **who matters right now** (active jobs, money owed, stale leads). Not a CRM; a working address book that orients around jobs.

## The data truth this screen must reflect
- **`customers` is the universal directory.** One table, a `kind` column: `lead · customer · vendor · sub · inspector · referral · other`. `type` (`residential | commercial`) is a customer-only subtype.
- **`agent` is de-scoped from the GC UI** (carryover from the pressure-washing vertical). The kind still exists in the data model — **hide it from the kind filter + badges; do not delete it from the schema** so existing rows aren't orphaned. The redesign simply doesn't surface it.
- **Lead vs. customer is defined by jobs, not a manual flag** (migration `0113`): a contact with **zero projects = lead**; a contact **with a project = customer**. This is "jobs are gravity" encoded in the schema — so the list must make project ownership legible, not hide it.
- Leads arrive from a real pipeline (lead-capture widget, lead-intake form, notification emails) and land here.

## Layout
- **Header:** "Contacts" + subhead "{n} contacts on file" (or "{n} shown of {m}" when filtered). Right: **New contact** (primary, ink, rust reserved for this one CTA). **Import with Henry is NOT a header action** — bulk contact import is an onboarding/migration task, so it lives in the standalone **Import hub** (same call as Billing). *(Also drop the redundant "Add new" button currently pinned in the filter row — keep one create path.)*
- **Filter bar (keep — works today):**
  - **Search** — name / email / phone / city, debounced, URL-state (`?q=`). Keep.
  - **Kind chips:** All · Lead · Customer · Vendor · Sub-trade · Inspector · Referral partner · Other (`?kind=`). When **Customer** is active, a second row reveals subtype chips: All customers · Residential · Commercial (`?type=`). Keep this hierarchy. *(No Agent chip — de-scoped for GC.)*
- **Table — four columns that each earn their place (GC-focused):** **Kind** · **Name** (links to detail) · **Reach** (phone-first — tap-to-call; email secondary) · **Signal** *(new — see below)*. Hairlines between rows, no zebra, white card on paper. **Dropped from the current table: Location and Added.**
  - *Why drop them:* a GC opens this list to **reach someone**, **chase a lead**, or **see who owes money** — not to learn who was added when (pure metadata) or what city they're in (province is always BC; the city is a job-site/dispatch concern that belongs on the project, not the contact glance). **Location stays searchable** (`?q=` already matches city) and lives on the contact detail. **Reach is phone-first** — flip the current `email→phone` order in `contactLine()` to `phone→email`; contractors work the phone from the truck.
- **Pagination (target — replaces the current `limit: 200` hard cap):** server-side; the query already supports `range(offset,…)` + `countCustomers`. Driven by the active filter/search.

## The one signal — make the rolodex orient around jobs *(target — new column)*
Add **one** compact derived signal per row answering "does this contact matter right now." It varies by kind:
- **Customer:** active-project + AR, e.g. `2 active · $4.2k due` — or `Active project` / `—`. Money in **CAD**, tabular-nums, **de-emphasized cents**.
- **Lead:** `New · 2d ago` with a quiet **stale** lean past N days (`No project yet`). This is the lead's whole reason to be in the list — surface it.
- **Vendor / sub / others:** `—` in v1 (open-bill / last-used is a later pass; don't over-build).
Requires a lightweight aggregate join the list query doesn't do today (`getCustomerRelated` already joins quotes/jobs/invoices on the detail — extend a count/sum to the lister). **Flag as target.** **Role-gate the dollar figure** (see Roles).

## Kind badge — collapse the rainbow into the Paper palette *(target — pattern-family change, flag it)*
Today `customer-type-badge.tsx` paints **8 raw Tailwind hues** (blue / amber / emerald / cyan / violet / rose / pink) — a documented choice (PATTERNS.md §7: "separate palette from status tones by design"), but it predates the deepened Paper palette + the clarity discipline now in DESIGN.md ("color is reserved for action," "one ink, one accent," "no more than three type sizes"). **A category is not an action** — eight colors for contact *kind* fights the whole system.
- **Target:** render kind as a **calm, neutral label** — muted ink pill or small mono-uppercase eyebrow, ink text on the white row. Reserve a single **soft-pair tone** only for the one kind that implies "act on me": **Lead → `warning`-soft** ("warm, not closed yet"). Everything else neutral.
- **Fix the column blend:** the Type column currently shows *segment* (Residential/Commercial) for customers but *role* (Vendor/Sub/…) for everyone else — two axes in one column. Make the column mean **kind**, consistently; show the customer subtype as a quiet secondary cue (`Customer · Residential`), not the primary badge.
- **⚠ This is a PATTERNS.md §7 pattern with named siblings** (project / invoice / job / quote / change-order status badges all read from `status-tokens.ts`). Changing the kind palette is an explicit decision — **surface it for blessing; don't silently repaint.** Status badges elsewhere stay as-is.

## Henry intelligence
- **Import with Henry** (real, PATTERNS.md §16) — AI-classified bulk import (dedup tiers, ephemeral preview, `import_batch` provenance + rollback). **Lives in the standalone Import hub, not on this screen** — onboarding/migration, not a daily directory action (same call as Billing).
- **Create-time duplicate detection** (real — `existing-matches-banner.tsx`, `confirmCreate`): when adding a contact, Henry surfaces strong/weak matches with "Use this / Create anyway." Keep.
- **List-level duplicate surfacing + merge** *(target — flag as such):* the dedup engine (`lib/customers/dedup.ts`) already exists; surface its hits at the directory level as a **quiet passive banner / quick-filter** — e.g. "2 possible duplicates — review" → merge flow. (The live data shows "Home Depot Pro" as both a Lead **and** a Vendor — exactly this case.) Label as Henry; merge is reversible (soft-delete) — give an undo.
- **Stale-lead nudge** *(target):* leads with no project past N days lean to the stale cue / a "needs attention" quick-filter. Henry as embedded triage, **not a chat box.**

## Role variations
- **Owner / admin:** full directory + the AR dollar signal + dedup/merge.
- **Member (crew):** sees the directory + contact info + "Active project" activity, **but not dollar AR amounts** (money is owner/admin). *(Confirm in Role × Object Matrix — flagged open question.)*
- **Homeowner:** **N/A — never reaches this screen.** This is a `(dashboard)` operator route; the homeowner boundary (no other customers, no other jobs, no money) is enforced by them living in the portal, not here. Don't add a homeowner view.

## Mobile vs desktop
- **Desktop:** filter bar + sortable-ish table + pagination.
- **Mobile:** cards **grouped by kind** (a "LEADS 3" / "CUSTOMERS 8" section label, then its cards) — keep this pattern. **Card anatomy — every card identical, AUTO-HEIGHT (never a fixed height with `overflow:visible`; that's what made the signal/location lines escape and collide with the next section header):**
  - **Line 1:** name (bold) + kind badge (right).
  - **Line 2:** phone (primary, tap-to-call) · email (muted secondary).
  - **Line 3:** the one signal — lead → "No project yet · 18d"; customer → "2 active · $4,200 due" — with the "messaging off" cue inline when present.
  - **No location, no added-date.** Internal vertical gap + bottom padding so Line 3 can't collide; section labels get clear top/bottom margin.
  - **Header subhead stays short on mobile** ("24 contacts") — the kind chips already carry the per-kind counts; don't repeat "· 6 leads · 8 customers" (it wraps).
  - **No Import button on this screen** — bulk contact import lives in the Import hub (onboarding/migration).
  - **Filters → a single sheet control, NOT a horizontal scroll-row.** The 8 kinds don't fit a chip strip on a phone (only ~3 show; the rest *and the active filter* hide off-screen). Use one **"Kind: All ▾"** button (active kind + count) that opens a sheet listing every kind with its count, Customer → Residential/Commercial nested. This is the **PATTERNS.md §9** rule (mobile = native select, never horizontal scroll). *Desktop keeps the inline chips — all 8 fit, no scroll.*
  New contact ("+") thumb-reachable; **44px+ touch targets**; honor the grid-cols-1 + `min-w-0` + hide-hover-only rules (PATTERNS.md §18).

## Financial / Canadian
- **AR outstanding** in **CAD**, tabular-nums, de-emphasized cents — owner/admin only.
- **CASL cue** *(target):* `customers.do_not_auto_message` is a CASL kill switch (auto-set on unsubscribe / STOP / complaint). Show a **quiet "messaging off"** tag on those rows so the operator knows before composing — muted, not loud.
- **Location is no longer a table column** (see Layout) — city/province live on the contact detail and stay searchable. No GST/HST here (that lives on quotes/invoices).

## States
- **Empty (fresh):** icon + Henry-voice headline + New contact + Import. Fix the copy — current fresh state says "No customers yet / Add your first customer" but this is the all-kinds directory: "No contacts yet. Add your first customer, vendor, or sub — or import your list with Henry."
- **Filtered-empty:** "No contacts match these filters." + clear-filters affordance (exists; keep).
- **Loading:** skeleton (exists — `contacts/loading.tsx`).
- **Duplicates found:** the passive Henry banner above (dismissible).

## Visual identity
Deepened **"Paper"** palette: warm paper field, white card table that floats, **solid warm hairlines** between rows (no zebra), ink text, mono-uppercase column heads. **Rust is the single accent** — the New-contact CTA only. Kind labels neutral; the one reserved tone (Lead → warning-soft) and danger (none here) via `status-tokens.ts`. **Three type sizes max.** Make whole rows navigate to the detail (not just the name), with a visible focus ring — fix today's misleading `cursor-pointer` on a non-clickable row.

## Subscreen inventory
Subscreens spec inline; the contact detail is a light route, not a graduate.

**Modals / dialogs**
- **Contact form** (`customer-form`) — create/edit: name · phone · email (+ additional emails) · kind (lead / customer / vendor / sub) · CASL consent. Phone normalized on entry (#276).
- **Pick-or-create** (`customer-picker-with-create` / `customer-picker`, §2) — the reusable contact selector used wherever a contact is attached (new project, estimate…).
- **Contact intake form** (`contact-intake-form`) — quick capture of a new lead/contact.
- **Duplicate-detection dialog** (§15) — flags a likely duplicate on create (the Contacts duplicates banner, #293) → merge / keep both.

**Inline / transient**
- **do-not-auto-message toggle** — suppresses AI sends only (never operator-typed); per contact.
- **Filter chips / search** — kind + CASL facets; row → detail.

**Sub-routes**
- **`/contacts/[id]`** — contact detail: their projects, AR signal, reach (phone-first), history. Light — spec inline, not a graduate.

## Accessibility
WCAG 2.2 AA: near-black ink on white (~16:1); never rely on color alone for kind/CASL (pair with a label/glyph); row is a real link/button with focus order; ≥44px hit targets on mobile; search + chips keyboard-operable (they are today).

## Open questions
- **Member money visibility** — does a member see AR dollar amounts, or activity-only? (Role × Object Matrix — confirm before build.)
- **Repaint blessing** — collapsing the kind rainbow touches a documented PATTERNS.md §7 pattern; needs an explicit yes + a per-sibling decision (siblings stay as status badges).
- **Signal cost** — is the per-row active-project/AR aggregate worth it on a paginated list, or computed only for the visible page? (Likely visible-page only.)
- **Do leads belong in the flat directory long-term, or graduate to a pipeline surface?** For now: in-directory, with the stale/needs-attention lean. (Minor — decide off the OD output.)
- **Temporal cue for customers** — leads carry freshness in the Signal; customers don't. If a follow-up nudge proves valuable, add a **"Last contacted"** column (last quote/invoice/message/log touch) — deferred (real query cost; not v1).
