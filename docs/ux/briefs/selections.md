# OD Brief — Selections (per-room finishes + allowances: the Hub tab + portal)

> **Grounded in:** `src/components/features/projects/tabs/selections-tab-server.tsx` (the operator tab — renders the customer-ideas section + room-grouped selection list + add dialog + a gallery photo-picker; marks customer ideas read on open), `src/components/features/portal/{selection-list,selection-form-dialog,selection-photo-picker,portal-selections,portal-selections-panel}.tsx` (the shared list + operator add dialog + the customer portal composer), query `src/lib/db/queries/project-selections.ts` (`listSelectionsForProject`, `groupSelectionsByRoom`), validator `src/lib/validators/project-selection.ts` (the category enum), actions `src/server/actions/project-selections.ts` (`createSelectionAction`/`updateSelectionAction`/`deleteSelectionAction` operator; **`addCustomerSelectionAction`/`deleteCustomerSelectionAction`** customer-via-portal; `setSelectionPhotoRefsAction`). Data: **`project_selections`** — `room`, `category` ∈ paint|tile|grout|flooring|trim|cabinets|countertop|fixture|appliance|hardware|other, `brand`/`name`/`code`/`finish`/`supplier`/`sku`/`warranty_url`/`notes`, **`allowance_cents`** (budget) + **`actual_cost_cents`** (actual), `image_storage_path`, `photo_refs` (jsonb → project photos), **`created_by`** ∈ operator|customer. Distinct sibling object: **`project_idea_board_items`** (customer inspiration/upsells; `promoted_to_selection_id` — `promote-idea-button.tsx` promotes an idea **into** a selection). Selections roll into `home_records` (`src/server/actions/home-records.ts`). Vault: Object Model `b4d880be` ("**Idea board and customer-authored selections are distinct — don't merge**"), Customer Portal module `c3e78671`, Home-Record framework `af12ea51` (the per-room materials record), Role × Object Matrix `03b1ccf4`. Siblings: **`project-secondary-tabs.md`** (the other Hub secondary tabs — this brief closes the Selections gap it flagged), **`public-pages.md`** (the portal render of selections), `estimate.md`/project Budget (allowances vs the budget).
> **How to use:** render the operator Hub tab (room-grouped selections + the customer-ideas strip) + the **client portal** view (read + author-own). It's a Project Hub secondary tab — mount in the hub shell (`project-hub.md`); don't redraw hub chrome. Then run `heyhenry-design-critique`.
>
> **Governing principle — the decided material spec, co-owned with the client, that pays off at closeout.** Selections is the per-room answer to *"what paint/tile/fixture went where, what did it cost vs. its allowance, and who chose it."* Three things govern it: (1) it's **dual-authored** — the operator catalogs the install spec; the client posts "what I chose" (lighter); (2) it carries **allowance vs actual** — the money signal that an over-allowance choice is a Change-Order/margin event; (3) it's the **seed of the Home Record** — every selection is a row in the permanent handoff. Keep it **distinct from the Idea Board** (inspiration) — ideas *promote into* selections, they aren't the same object.
>
> **Current vs target:** built and live as a Hub tab + portal surface — room-grouped selections, operator add/edit dialog, a gallery photo-picker, the customer-ideas strip on top, and a customer portal composer. **Target (the deltas):** (1) **surface allowance-vs-actual** — the fields exist (`allowance_cents`/`actual_cost_cents`) but the tab reads as a flat catalog; make over-allowance legible (it's a CO/margin trigger); (2) **Paper-palette restyle**; (3) tighten the **idea→selection promotion** affordance; (4) terminology — the tab copy says "homeowner," should be **"client."** **Flagged** throughout.

**Object:** **Selection** (`project_selections`) — a per-room material/finish choice (paint code, tile SKU, fixture, etc.) with an optional allowance + actual cost. · **Roles:** owner/admin/member (full catalog); **client** (author + edit/delete *their own* `created_by='customer'` rows via the portal; see all); worker (never). · **Primary action (operator):** catalog what's going in each room so it's tracked, costed, and handed off. **(client):** record "here's what I picked" + see what's been chosen.

## Purpose
The renovation's **finish schedule**. A reno lives or dies on selections — the paint colors, tile, grout, flooring, fixtures, hardware, appliances per room — and on whether those choices stayed within their **allowances**. This tab is where the operator pins down that spec, the client co-authors and confirms it, and the data flows into both the budget (allowance variance) and the closeout Home Record (the permanent "what's in my house" record).

## Layout *(operator Hub tab — compose from `card`, `dialog`, `badge`, `money`, room groupings)*
1. **Customer ideas strip** (`CustomerIdeasSection`) — the client's posted inspiration (idea board) at the top, with a **promote-to-selection** affordance; opening the tab marks them read (`read_by_operator_at`), mirroring Messages.
2. **Selections, grouped by room** (`groupSelectionsByRoom`) — each room a section; each selection a row/card showing category + brand/name/code/finish + supplier/SKU + **allowance vs actual** + thumbnail (uploaded image or linked gallery `photo_refs`) + warranty link. `created_by` distinguishes operator vs client rows.
3. **Add selection** (`SelectionFormDialog`) — the full operator spec (room · category · brand/name/code/finish · supplier/SKU · warranty URL · allowance · actual · notes · photos).
4. **Photo-refs picker** (`selection-photo-picker`) — link existing project gallery photos to a selection (not a re-upload).

## The idea → selection flow *(distinct objects; one direction)*
- **Idea Board** (`project_idea_board_items`): the client posts inspiration (image / link / note + room) — upsell + "what I'm thinking" signal. Customer-authored, lives in the portal.
- **Promotion:** the operator reviews an idea and **promotes it into a Selection** (`promoted_to_selection_id`) — the idea becomes the decided spec. *One-way; don't merge the tables (`b4d880be`).*
- The Selections tab is where both meet: ideas in (top), decided selections below.

## Allowance vs actual — the money angle *(target: make it legible)*
Each selection carries `allowance_cents` (the budgeted allowance) and `actual_cost_cents` (what it actually cost). **Over-allowance is a margin/CO event** — the client chose the $80/sqft tile against a $40 allowance. Today these are flat fields; the redesign should surface variance per selection + a room/project roll-up, and tie an over-allowance to the Change-Order path (the locked convention: scope/cost change → CO, human-approved). This is the bridge from Selections to Budget/variance.

## Progressive disclosure
- **Snapshot:** rooms with their selection counts + any over-allowance flag.
- **Operational:** add/edit a selection; promote an idea; link photos.
- **Detail:** the full spec (SKU/supplier/warranty) — the Home-Record-grade data.
- **Audit:** `created_by` + timestamps; the worklog isn't the primary record here — the selection row is.

## Henry intelligence touchpoints *(surfaces; never auto-commits the spec)*
- **Extract from photos/receipts** — snap a paint can / tile box / receipt → Henry drafts a selection (brand/code/SKU); operator confirms. Capture-now/clean-up-later.
- **Allowance-over nudge** — "Master-bath tile is $1,200 over its allowance — start a Change Order?" Deterministic from allowance vs actual; one tap to the CO path. Labeled `✦`, dismissible.
- **Home-Record assembly** — selections auto-populate the closeout per-room materials record (the highest-value handoff content per `af12ea51`). Henry assembles; operator reviews before send. Per `[[feedback_henry_intelligence_not_chat]]`.

## The edges — related, not the same
| Surface | Relationship |
|---|---|
| **Idea Board** (`project_idea_board_items`) | Client inspiration; **promotes into** a selection. Distinct object — don't merge |
| **Home Record** (`project-secondary-tabs.md` Documents) | Selections are the per-room materials rows in the frozen handoff |
| **Budget / allowances** (`estimate.md`, project Budget) | Allowance vs actual variance feeds margin; over-allowance → Change Order |
| **Photos** (`project-secondary-tabs.md`) | `photo_refs` link gallery photos to a selection (no re-upload) |
| **Portal** (`public-pages.md`) | The client-facing render + the customer composer |

## Role variations
- **Owner / admin / member:** full catalog — create/edit/delete any selection, set allowances/actuals, promote ideas, link photos.
- **Client (portal):** sees all selections; **authors their own** (lighter composer — room · category · name · code · notes · one image; `created_by='customer'`); can edit/delete **only their own** rows (server-enforced). Never sees margin, supplier cost beyond what's shared, or other projects.
- **Worker:** never — not a field-capture surface (though Henry photo-extract could later feed it from the field).

## Mobile vs desktop
- **Operator:** desktop for cataloging the full spec (SKUs, suppliers, allowances); mobile for a quick add or a photo-extract on site.
- **Client:** **mobile-first** — they post "what I chose" + browse selections from a phone in a showroom. ≥44px, single-image upload, minimal fields.

## Financial / Canadian
- **Allowance vs actual** in CAD cents (`Money`, tabular). The allowance is the contractual budget per finish; actual is what the client's choice cost. **Over-allowance variance is the CO/margin trigger.**
- No tax math on the selection itself (it flows through the cost line / CO). **No holdback.**

## States
- **Empty:** "No selections yet — catalog the paint, tile, and fixtures going in each room" + add CTA; client portal empty = "your contractor will add finishes here; you can post what you've chosen too."
- **Loading:** the hub `tab-skeleton`.
- **Error:** actions return `{ ok, error }` + toast; customer image upload validates type/size (≤10MB, JPEG/PNG/WebP/GIF).
- **Offline:** not an offline-first surface; image upload needs connection.

## Subscreen inventory
- **Operator add/edit dialog** (`SelectionFormDialog`) — **MEDIUM → inline.** The full per-room spec form.
- **Photo-refs picker** (`selection-photo-picker`) — **MEDIUM → inline.** Link gallery photos to a selection.
- **Client portal composer** (`addCustomerSelectionAction`) — **MEDIUM → spec in `public-pages.md` portal.** Lighter "what I chose" form + single image.
- **Idea → selection promotion** (`promote-idea-button`) — **LIGHT → inline.** Operator promotes a client idea into a selection.
- **Customer-ideas strip** (`CustomerIdeasSection`) — **LIGHT → inline.** Read + promote; mark-read on tab open.

## Accessibility
WCAG 2.2 AA: room groupings are real semantic sections/headings; category + `created_by` (operator vs client) are label+glyph, not colour-only; over-allowance variance carries a label, not just a red number; the photo picker + image uploads have alt/labels; ≥44px targets on the client composer; dialog focus-trapped + keyboard-operable.

## Decisions / Open questions
1. **Surface allowance variance** (the headline) — the fields exist but aren't shown as variance. Recommend a per-selection allowance/actual delta + a room/project roll-up, wired to the CO path on overage. Confirm scope with OD (display) + a Coding follow-up (the CO link).
2. **Idea→selection promotion ergonomics** — confirm the affordance is discoverable; should a promoted idea carry its image into the selection automatically?
3. **Terminology** — tab copy says "homeowner" → **client** (`[[feedback_client_not_homeowner]]`).
4. **Relationship to closeout** — selections are the richest Home-Record content; confirm the Home-Record generate flow (in `project-secondary-tabs.md`) pulls every selection + its photos + warranty links.
