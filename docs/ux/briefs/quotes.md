# OD Brief — Quotes (the sales-quote object: PW measurement tool + the GC estimate boundary)

> **Grounded in:** `src/app/(dashboard)/quotes/page.tsx` (the list/pipeline — **redirects `renovation`/`tile` tenants to `/projects`; this surface is pressure-washing-only**), `src/components/features/quotes/` (`pipeline-tabs.tsx` All/Draft/Sent/Declined/Expired, `quote-table.tsx`, `quote-form.tsx`, `quote-map.tsx` + `surface-list.tsx` = the PW polygon model, `quote-actions.tsx`, `stale-quotes-list.tsx`, `quote-empty-state.tsx`), `src/app/(dashboard)/quotes/{new,[id],[id]/edit,stale}/page.tsx`, `src/server/actions/quotes.ts` (the lifecycle: `createQuoteAction`/`updateQuoteAction` → server-priced from catalog; `sendQuoteAction` → PDF + email + `approval_code` + follow-up autopilot; `acceptQuoteAction`/`rejectQuoteAction`; **`convertQuoteToProjectAction`** (GC) + `convertQuoteToJobAction` (deprecated `jobs`); `duplicateQuoteAction`; **public** `approveQuotePublicAction`/`declineQuotePublicAction`), `src/app/(public)/view/[id]/page.tsx` + `quote-approval-form.tsx` (the customer "Your Estimate" page — no login, admin client, `noindex`). Data: **`quotes`** (`status` ∈ draft | sent | accepted | rejected | expired; `approval_code`; `sent_at`/`accepted_at`; `pdf_url`; `subtotal/tax/total_cents`; `auto_followup_enabled`; soft-delete) + **`quote_line_items`** (label/qty/unit/`unit_price_cents`/`line_total_cents`/sort) + **`quote_surfaces`** (PW: `surface_type`/`sqft`/`polygon_geojson`/`price_cents`, links to a line item). GC path uses **`projects.estimate_status`** (`pending_approval`) + `estimate_sent_at` (the stale page reads these). Tax via `canadianTax.getCustomerFacingContext` (customer-facing rate only). Vault: Object Model `b4d880be` (**"Estimate = quote"; "Auto-create Project on quote approval" is a flagged TARGET, not built**), Workflow Library `e0263cc3` (#2 Quoting; locked convention "Approved Quote auto-creates the Project in Booked state — no manual Book Job step"), Role × Object Matrix `03b1ccf4` (Quote: owner/admin/member Full; worker ✕; **client View+approve own via link**). Siblings: **`estimate.md`** (the GC project-budget authoring — *this is the GC "quote"*), `project-hub.md` §Budget, the **Public-pages brief** (the GC project-estimate `/approve*` approval surface), `contacts.md` (leads → quotes).
> **How to use:** read the **Scope boundary** section FIRST — it decides what (if anything) gets a new render. If OD renders the PW quoting tool, generate desktop + mobile of the pipeline list + the `/view/[id]` customer estimate; the GC estimate path renders live in `estimate.md` + the Public-pages brief, not here. Then run `heyhenry-design-critique`.
>
> **Governing principle — one quoting path per vertical; do NOT merge them.** Pressure-washing quotes on a **map** (measure surfaces → sqft → catalog price → line items): that's `/quotes`. GC/renovation quotes as a **scope + budget on a Project** (`estimate_status` sent for approval): that lives on the Project. The code already enforces this — `/quotes` *redirects renovation/tile to `/projects`*. The redesign **targets GC**, so the headline truth of this brief is a boundary, not a redesign: **the standalone Quotes screen is the PW tool; the GC "quote" is the project estimate (`estimate.md`).** Treating them as one screen is the mistake to avoid.
>
> **Current vs target:** **Current** — two parallel realities. (1) *PW:* `/quotes` is a live polygon-measurement pipeline (draft→sent→accepted/rejected/expired) with a PDF + no-login customer "Estimate" page + a follow-up autopilot; accepted quotes are **manually** converted (`convertQuoteToProjectAction` seeds 9 default budget categories at a 12% mgmt fee, or the deprecated `convertQuoteToJobAction`). (2) *GC:* there is **no standalone GC quote** — the estimate is the project budget, sent via `projects.estimate_status`. **Target (the decided-but-unbuilt delta):** the locked convention says an **approved quote auto-creates the Project in Booked state** — no manual convert step. Today that step is manual (PW) or the project already exists (GC, project-first). Reconciling "quote-first auto-create" with "GC project-first" is the central open decision (below). **Flagged** throughout.

**Object:** **Quote** (`quotes`) — a priced sales proposal to a customer; customer-facing name is **"Estimate."** Lines = `quote_line_items`; PW adds `quote_surfaces` (map polygons). · **Roles:** owner / admin / member (full author/send); worker (never); **client** (view + accept/decline their own, via a no-login `approval_code` link). · **Primary action (operator):** price it, send it, get it approved, turn it into work. **Primary action (client):** understand the estimate and accept/decline in one tap.

## Purpose
The pre-project sales surface: *"here's what the work costs; say yes."* For **PW** it's the whole front door (measure → quote → win → schedule). For **GC** the front door is the Project itself (the estimate is authored as the project budget and sent for approval) — so for the GC redesign the Quote object's job is mostly **lifecycle + customer approval + conversion**, not authoring. This brief maps the object honestly across both so the redesign doesn't accidentally rebuild the PW map tool for GC users who never see it.

## The scope boundary *(read before rendering anything)*
| | **PW (`/quotes` — built, live)** | **GC / renovation (the redesign target)** |
|---|---|---|
| Where the quote lives | Standalone `quotes` + `quote_surfaces` | **On the Project** (`projects.estimate_status`, budget = `estimate.md`) |
| Authoring | Map polygons → sqft → catalog price | Scope + budget categories/cost lines (project Budget tab) |
| `/quotes` route | The pipeline | **Redirects to `/projects`** |
| Customer approval | `/view/[id]` ("Your Estimate") | The project-estimate `/approve*` page (**Public-pages brief**) |
| Convert to work | `convertQuoteToProjectAction` (manual) | Project already exists; estimate-approval activates it |
**Recommendation:** the standalone Quotes screen is **PW-vertical**; render/refresh it only as PW work. The **GC quote redesign is already owned** by `estimate.md` + `project-hub.md` §Budget + the Public-pages approval surface. Don't open a GC "Quotes" render — point GC quoting energy at those.

## Layout *(PW operator surface — compose from `table`, `badge`, `tabs`, `card`, `button`, `money`, `dialog`, `map`)*
1. **Pipeline header** — "Pipeline" + counts line ("N draft · N sent · N expired · N declined") + **New quote** + **Stale quotes** (≥7-days-sent-unanswered) actions.
2. **Pipeline tabs** — All / Draft / Sent / Declined / Expired (URL `?status=`; mobile native `<select>`). *Accepted quotes intentionally leave the pipeline (they become projects/jobs).*
3. **Quote table** — per row: customer, total (`Money`), status badge, sent/age. Row → detail.
4. **Detail `/quotes/[id]`** — the quote (line items + surfaces map), status, and `quote-actions` (send/resend, accept, reject, duplicate, convert, delete).
5. **Authoring `/quotes/new` + `/edit`** — the map + surface list (PW); server prices from catalog (never trust client). *(GC authoring is the project Budget, not here.)*

## The customer "Estimate" surface `/view/[id]` *(public, no login, `noindex`)*
- Business header + Quote #, "Prepared for," date, address, status; **line-item table** (description · qty+unit · price); subtotal · GST (rate shown) · total; **GST/WCB numbers**; notes; **valid-until** (sent_at + `quote_validity_days`); **Download PDF**; **Accept / Decline** (only while `sent` and not expired) → `approveQuotePublicAction` / `declineQuotePublicAction`; accepted/declined confirmation states.
- **Redesign target:** this page is plain gray/white + raw emerald — bring it to the **GC's brand** (tenant logo + Paper palette), since it "carries the GC's brand" to the client. Keep it dead-simple and mobile-first (clients open it on a phone).

## Progressive disclosure
- **Snapshot (operator):** the pipeline counts + the at-risk read (stale/expiring quotes).
- **Operational:** the table; the detail with send/convert actions.
- **Detail:** line items + (PW) the surfaces map; the generated PDF.
- **Audit:** every transition writes a `worklog_entries` system row (sent/accepted/rejected/converted) on the quote — that's the history; no separate audit view.

## Henry intelligence touchpoints *(surfaces + accelerates; never auto-sends to the customer)*
- **Quote follow-up autopilot** *(built)* — on send, enrolls the quote in an AR follow-up sequence (`emitArEvent('quote_sent')`, per-quote `auto_followup_enabled` override). Henry chases the unanswered estimate so the operator doesn't have to. Surface the enrollment state + let the operator opt a quote out per-send.
- **Approved → seed the work** *(built — `onQuoteApproved`)* — on accept, Henry seeds tasks from the quote's scope categories and drops an operator todo ("Schedule job — estimate accepted"). In the target auto-create flow this becomes "project drafted, review it," never silently activated.
- **Stale-quote nudge** — the `/quotes/stale` list (≥7d sent, unanswered) is the surface; Henry ranks "most worth a nudge" and one-taps the follow-up. Display/undo per `[[henry-intelligence-not-chat]]`.

## The edges — what's quote-adjacent but a different object
| Surface | Relationship |
|---|---|
| **Project Budget / `estimate.md`** | The **GC quote**. Quote object defers to it for renovation/tile |
| **Project** | An accepted quote converts to one (manual today; auto-create is target). Don't duplicate project setup in the quote |
| **Sub-quotes** (`project_sub_quotes`, `sub-quote-form.tsx`) | A **vendor/sub's bid on a project** — opposite direction (inbound), different object. Not this screen |
| **Contacts / leads** (`customers.kind='lead'`) | Quotes are sent to a customer/lead; the lead-gen `public-quote-form` is a public quote-*request* widget (intake), feeding here |
| **Public approval `/approve*`** | The GC **project-estimate** approval (Public-pages brief). `/view/[id]` is the **PW quote** equivalent |
| **Settings → Quotes** (`/settings/quotes`) | Validity days, auto-followup default, public quote link — specced in the **Settings brief** |

## Role variations
- **Owner / admin / member:** full author/send/convert (no role gating in code beyond tenant).
- **Worker:** never — no quote surface in `/w`.
- **Client (no-login, via link):** the `/view/[id]` estimate — view + accept/decline their **own** quote via `approval_code`; never sees other quotes, internal pricing math, margin, or the surfaces' catalog cost. (Customer-facing copy says "Estimate," never "Quote.")

## Mobile vs desktop
- **Operator desktop:** authoring (the map tool) + pipeline review are desktop work.
- **Operator mobile:** glance the pipeline, send/resend, nudge a stale quote.
- **Client:** **mobile-first** — the `/view/[id]` estimate is opened on a phone from an email/SMS link; accept/decline must be thumb-easy (≥44px), no pinch-zoom on the line-item table.

## Financial / Canadian
- **Customer-facing tax only** — `resolveQuoteTaxRate` applies the customer-facing rate (HST 13/15%; PST/RST/QST **stripped** since the client never sees provincial sales tax broken out; `0` when the customer is `tax_exempt`). The `/view/[id]` page shows the GST rate + the tenant's **GST/WCB numbers** (Canadian trust signals on the PDF + page).
- **CAD**, cents, `Money`. Quote **validity window** = `quote_validity_days` (default 30) from `sent_at`. **No holdback.** Payment/e-Transfer is an Invoice concern, not a quote concern.

## States
- **Empty:** `quote-empty-state` (fresh vs filtered). Fresh = "create your first quote"; filtered = "no quotes in this tab."
- **Loading:** `/quotes/loading.tsx` + Suspense on the pipeline tabs.
- **Error:** actions return `{ ok, error }`; PDF + email are **best-effort** (a send still succeeds + warns if the customer has no email / PDF fails — preserve this resilience; surface the warning).
- **Expired:** computed (sent_at + validity) — the customer page shows an "expired, contact us" state; the pipeline has an Expired tab.
- **Offline:** authoring needs the catalog + map tiles online; not an offline surface.

## Subscreen inventory *(don't skip)*
- **New / Edit quote** (`/quotes/new`, `/quotes/[id]/edit`) — **HEAVY (PW) → own render.** The map + surface-list authoring; server-priced. GC: n/a (project Budget).
- **Quote detail** (`/quotes/[id]`) — **MEDIUM → inline/own.** Read view + `quote-actions` (send/accept/reject/duplicate/convert/delete). Convert opens the project-creation path.
- **Stale quotes** (`/quotes/stale`) — **LIGHT → inline.** A ≥7-day-unanswered list (gated by `customers.followup_sequences` feature); the nudge surface.
- **Customer estimate** (`/view/[id]`) — **HEAVY → own render** (it carries the brand). Specced above.
- **Public quote-request widget** (`public-quote-form.tsx`, lead-gen) — **MEDIUM → own/Public-pages.** A customer-initiated quote request → intake. Note as an entry point; spec with intake/lead-gen.
- **Convert dialog** (accepted → project) — **MEDIUM.** Today a manual action seeding 9 default budget categories @ 12% mgmt fee; in the target this is the auto-create-on-approval moment — spec the "review the drafted project" confirmation, never a silent activate.
- **Settings → Quotes** — graduate to the **Settings brief** (don't spec here).

## Accessibility
WCAG 2.2 AA: status never colour-only (badge label + glyph, not just hue — the `/view` accepted state uses raw emerald; fix in the brand restyle); line-item + pipeline tables are real table semantics; the customer accept/decline are ≥44px buttons with clear labels; the map authoring tool needs a non-map fallback path for keyboard/AT (a list-based surface entry) — flag for the PW render.

## Decisions / Open questions
1. **Is the standalone Quotes screen in the GC redesign scope at all?** *Recommendation:* **No** — it's PW-vertical; GC quoting = `estimate.md` + project Budget + the `/approve*` page. This brief is the map + boundary, not a GC render request. **Confirm** so OD doesn't open a GC Quotes render.
2. **Auto-create Project on approval (the locked convention) vs GC project-first.** Today: PW = manual convert; GC = project exists before the estimate. Decide the unified target: does an approved **PW** quote auto-draft a project (review-then-activate)? Does GC keep project-first? This is a **foundation/Ops decision** (touches `projects` lifecycle + `estimate_status`), then a Coding follow-up — not an OD render.
3. **Customer "Estimate" page brand pass** — bring `/view/[id]` to tenant logo + Paper palette (it's a brand-carrying surface). Coordinate with the Public-pages brief so the PW quote view and the GC `/approve*` view share one calm, branded, no-login template.
4. **Deprecated `convertQuoteToJobAction` / `jobs`** — confirm the `jobs` table is dead for the redesign; the quote→work path is `projects` only.
