# OD Brief — Settings (the operator's configuration hub: IA · role-gating · 30 sub-pages)

> **Grounded in:** `src/app/(dashboard)/settings/layout.tsx` (the two-column shell — sidebar + pane; fetches `tenant.vertical` to filter the nav), `src/app/(dashboard)/settings/page.tsx` (**redirects `/settings` → `/settings/profile`** — no flat landing), `src/components/features/settings/settings-nav-items.ts` (**the single source of truth for the nav** — 6 groups; `getSettingsNav(ctx)` filters by **vertical**; `isSettingsItemActive` startsWith-matches so orphan routes light their parent), `settings-sidebar.tsx` + `settings-mobile-nav.tsx` (desktop nav / mobile `<select>`), and the 30 sub-page routes under `src/app/(dashboard)/settings/*` with their form/card components in `src/components/features/settings/*`. Role rules from **Role × Object Matrix `03b1ccf4`**: **owner-only** = Billing/subscription, Security (require-MFA), account deletion; **owner+admin** = Team + worker profiles; **member** = operational only (no team/billing/security). Vault: Object Model `b4d880be`, IA & Nav Map `6529e9ae`, Positioning `5bfa59be`. Siblings: many settings sub-pages **own the defaults that other briefs' screens consume** — `quotes.md` (Settings→Quotes), `invoices.md` (Settings→Invoicing/Stripe/QBO), `calendar.md` (Settings→Calendar feed), `client.md`/Public-pages (Settings→Customer portal), `business-health.md` (Settings→Payment sources/QBO).
> **How to use:** the deliverable here is **the shell + the IA**, not 30 form redesigns. Render desktop + mobile of the settings **shell** (sidebar groups + a representative pane) and the **role-filtered nav**; spec each sub-page in the Subscreen Inventory (light = inline one-liner, heavy = graduate). Then run `heyhenry-design-critique` on the shell.
>
> **Governing principle — a calm hub over a sprawling drawer.** Settings is **30 pages**; the redesign job is to make that sprawl navigable and *honest about who can touch what*, not to repaint every form. Three rules govern it: (1) **group by the operator's mental model** (Account · Billing · Estimating · Money/Integrations · Operations · Data) — already the structure, keep it; (2) **show only what this role + vertical can use** — the nav must stop lying; (3) **every setting is a default that lives downstream** — a settings change should preview its effect, not just save silently.
>
> **Current vs target:** the shell is built and live — a persistent left sidebar (6 groups), a redirect-to-profile root, a mobile `<select>`, and **vertical filtering** (GC verticals hide **Pricebook** — "zero of 336 priced cost lines on prod referenced a catalog item"). **Target (the deltas):** (1) **role-filter the nav** — today `getSettingsNav` filters by *vertical only*, so a `member` sees Billing/Security/Team they can't use (pages gate at the server, but the nav advertises them); (2) **Paper-palette restyle** of the shell + form cards; (3) **prune/merge the sprawl** — 30 destinations is a lot; some merge candidates below; (4) consider a **search/filter** over settings (30 items is past the glanceable limit). **Flagged** throughout.

**Object:** Tenant configuration — `tenants` + the worker/integration/template tables each sub-page edits. Not a single object; an **IA over the tenant's defaults**. · **Roles:** owner (everything, incl. billing/security/delete); admin (everything operational + team, **no** billing/security/delete); member (their own profile + operational reads, **no** team/billing/security); worker/client (never — `/settings` is dashboard-only). · **Primary action:** find the right setting fast, change it, and understand what it affects.

## Layout *(the shell — compose from sidebar nav, `card`, form primitives)*
1. **Left sidebar** (`w-60`, sticky, `sm:` and up) — 6 uppercase group labels, each with icon+label items; active item = filled `bg-foreground`. Stays mounted across navigations (only the pane re-renders).
2. **Mobile nav** — a native `<select>` replaces the sidebar under `sm:` (the established mobile-nav pattern).
3. **Right pane** — the active sub-page; wider than the rest of the app (the sidebar eats 240px). Each sub-page = a `settings-page-header` + one or more cards/forms.
4. **Root** — `/settings` redirects to `/settings/profile` (Business profile is the de-facto home).

## The IA — 6 groups, role + vertical gates *(the spine)*
| Group | Items (route) | Role gate (target) | Vertical |
|---|---|---|---|
| **Account** | Business profile (`/profile`) · Your profile (`/your-profile`) · Security (`/security`) · Audit log (`/audit`) · Team (`/team`) | profile=all; **Security=owner**; Audit=owner/admin; **Team=owner/admin** | all |
| **Billing & plan** | Billing (`/billing`) | **owner only** | all |
| **Estimating & quotes** | Project defaults · Estimating detail · **Pricebook** · Cost catalog · Budget templates · Estimate snippets · Quotes | owner/admin (config) | **Pricebook hidden for GC**; review the rest for PW-isms |
| **Money & integrations** | Stripe · QuickBooks · Payment sources · Invoicing · Expense categories | owner/admin (owner for billing-linked) | all |
| **Operations** | Automations · Reminders · Checklist · **Customer portal** | owner/admin | all |
| **Data & tools** | Calendar feed · Data export · Import data (`/import`) · Voice | owner/admin; export=owner | all |

## The menu's named sub-pages *(the ones the pipeline called out)*
- **Team / invite** (`/settings/team`) — manage `tenant_members` + `worker_profiles`; invite flow (`worker_invites`). **owner/admin only.** The seat/role surface — ties to `[[feedback_heyhenry_intent_led_positioning]]` (capacity is a footnote, not the pitch).
- **Pricebook / materials** (`/settings/pricebook`, `materials_catalog`) — **hidden for GC** (GC builds scope in the project Budget). Keep for PW; don't surface in the GC redesign.
- **Portal defaults** (`/settings/customer-portal`, `tenant-portal-settings-form`) — branding + visibility defaults + `notify_customer_on_schedule_change`; the org-level defaults the per-project portal (`client.md`/Public-pages) inherits.
- **Calendar** (`/settings/calendar`, `calendar-feed-card`) — the **iCal feed** subscription (export crew schedule to Google/Apple Cal), not the scheduling surface (`calendar.md`).
- **Billing / subscription** (`/settings/billing`) — plan + subscription management. **owner only**; grandfather existing customers on plan changes per `[[feedback_pricing_grandfather_principle]]`.

## Progressive disclosure
- **Snapshot:** the sidebar *is* the snapshot — every destination visible, grouped, one click away.
- **Operational:** the sub-page form; save with optimistic/`{ok,error}` feedback.
- **Detail:** integration sub-flows (QuickBooks connect → class-mapping → import review) layer deeper.
- **Audit:** `/settings/audit` (`audit_log`) is the tenant's change history — its own destination.

## Henry intelligence touchpoints *(config, not chat)*
- **Voice** (`/settings/voice`) + **Automations** (`/settings/automations`) + **Reminders** — this is where **Henry is configured** (the AI behind the product). Frame as "what Henry does for you," consistent with `[[feedback_henry_intelligence_not_chat]]` and `[[feedback_henry_voice_standard_all_tiers]]` (voice is standard on every tier — don't present it as a tier-gate).
- **Template suggestions** (`template-suggestions-card`) — Henry proposes estimate snippets/budget templates from the tenant's history; surfaced in the Estimating group.
- **Setting → preview the effect** (target) — when a default changes (e.g. portal visibility, invoicing terms), show what it changes downstream rather than a silent save.

## The edges — Settings owns defaults other screens consume
| Setting | Downstream screen |
|---|---|
| Quotes / Estimating / Pricebook | `quotes.md`, `estimate.md`, project Budget |
| Invoicing / Stripe / Payment sources | `invoices.md`, `business-health.md` |
| QuickBooks (+ class-mapping/history/review) | `business-health.md` (the QBO handoff line) |
| Customer portal | `client.md`, Public-pages portal |
| Calendar feed | `calendar.md` |
| Team / worker profiles | `calendar.md` (crew), Worker app `/w` |

## Role variations
- **Owner:** the full hub, incl. Billing, Security (require-MFA enforcement), account deletion.
- **Admin:** everything operational + Team + worker profiles; **no** Billing, Security toggles, or account delete.
- **Member:** Your profile + operational reads; **no** Team/Billing/Security. *(Nav must hide these — current gap.)*
- **Worker / client:** never — `/settings` is a dashboard-only surface.

## Mobile vs desktop
- **Desktop:** the two-column sidebar hub — settings is desktop "thinking work."
- **Mobile:** the `<select>` nav + single-column forms; keep the most-used (Business profile, Team, Invoicing) thumb-friendly. Most settings are rare-touch — don't over-invest in mobile for the deep integration pages.

## Financial / Canadian
Settings holds the **Canadian financial config**: GST/HST + PST/QST rates (per province), GST/WCB numbers (on quotes/invoices/PDFs), payment sources (incl. **e-Transfer**), Stripe + QBO connections, and **owner-draw GST mode** (`draw-gst-mode-setting`). Subscription billing is CAD. **No holdback** (dropped). T-slip/year-end config lives in the out-of-scope `/bk` portal, not here.

## States
- **Empty:** integration cards show "not connected" CTAs (Stripe/QBO); templates/snippets show "create your first."
- **Loading:** per-pane; the sidebar stays mounted (no full-page reload between settings).
- **Error:** form saves use `{ ok, error }` + toast; integration OAuth failures need a clear reconnect path.
- **Permission:** a member hitting an owner-only URL directly should get a clean "owner only" state, not a crash (pairs with the nav-filtering fix).

## Subscreen inventory *(30 destinations — enumerate; light=inline, heavy=graduate)*
**Account:** Business profile (logo upload + socials — MEDIUM) · Your profile (LIGHT) · Security (MFA + require-MFA — MEDIUM, **owner**) · Audit log (read list — LIGHT) · Team (members + invite + worker profiles — **HEAVY → own render**, owner/admin) · account/delete (destructive — MEDIUM, **owner**, orphan under Account).
**Billing:** Billing/subscription (plan management — **HEAVY → own render**, owner).
**Estimating & quotes:** Project defaults · Estimating detail level · Pricebook (**PW-only**, GC-hidden) · Cost catalog · Budget templates · Estimate snippets · Quotes (settings) — mostly MEDIUM form managers; Pricebook + Cost catalog are list-managers.
**Money & integrations:** Stripe connect (MEDIUM) · **QuickBooks** (connect + `qbo-class-mapping` + `qbo-history` + `qbo-review` — **HEAVY → own render**, a multi-page integration flow) · Payment sources (list manager — MEDIUM) · Invoicing defaults (MEDIUM) · Expense categories (list — LIGHT).
**Operations:** Automations (Henry autopilots — MEDIUM) · Reminders (MEDIUM) · Checklist settings (LIGHT) · Customer portal (branding/visibility defaults — MEDIUM).
**Data & tools:** Calendar feed (iCal — LIGHT) · Data export (MEDIUM, owner) · **Import data** (`/import` — **HEAVY → own flow**, the import wizard) · Voice (Henry voice config — MEDIUM).
> Heavy sub-flows that graduate to their own renders/rows: **Team/invite**, **Billing/subscription**, **QuickBooks integration**, **Import data**. The rest render as the shell + a representative form pattern.

## Accessibility
WCAG 2.2 AA: the sidebar is a real `<nav aria-label>` with a proper list; active state is not colour-only (filled + text); the mobile `<select>` is labeled; form fields labeled; destructive (account delete) needs confirm + clear consequence text; ≥44px nav targets on mobile; focus order follows the visual group order.

## Decisions / Open questions
1. **Role-filter the nav** (the headline) — pass the member's role into `getSettingsNav` and hide owner/admin-only items; pages keep their server gate as defense-in-depth. **Coding + a small Ops confirm** on the exact per-role visibility matrix.
2. **Prune/merge 30 → fewer** — merge candidates: QuickBooks + class-mapping + history + review into one QBO hub (already startsWith-grouped); Pricebook + Cost catalog + Budget templates + Estimate snippets into an "Estimating library." Confirm appetite before OD draws a consolidated IA.
3. **Settings search** — 30 items is past glanceable; a filter/command over settings. Defer or V1?
4. **Vertical filtering beyond Pricebook** — audit the Estimating group for other PW-isms to hide for GC (the brief targets GC).
5. **Terminology** — "Customer portal" keeps the allowed data term "customer"; ensure no "homeowner" leaks into settings copy (`[[feedback_client_not_homeowner]]`).
