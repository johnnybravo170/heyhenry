# OD Brief — Import / export data (the bulk data-plumbing flows)

> **Grounded in (read these before prompting):**
> - **The screen is three surfaces, not one.** The task named `/settings/imports`, but the real feature spans:
>   1. **`/import`** — the **import hub** (`src/app/(dashboard)/import/page.tsx`): 6 entity tiles + a recommended-next-step heuristic + a deep-link to the imports list. This is what the Settings nav **"Import data"** actually points at (`href: '/import'`, NOT `/settings/imports` — see `src/components/features/settings/settings-nav-items.ts:101`).
>   2. **6 entity wizards** at `/{entity}/import` — `customer-import-wizard.tsx`, `project-import-wizard.tsx`, `invoice-import-wizard.tsx`, `receipt-import-wizard.tsx`, `photo-import-wizard.tsx`, `time-entry-import-wizard.tsx`, all under `src/components/features/onboarding/`. Each is its own `maxDuration = 300` route page (`contacts/import`, `projects/import`, `invoices/import`, `expenses/import`, `photos/import`, `time/import`).
>   3. **`/settings/imports`** — the **batch-history / rollback list** (`src/app/(dashboard)/settings/imports/page.tsx` → `onboarding/imports-list.tsx`): every `import_batches` row, newest first, with a per-kind Roll-back action.
>   4. **`/settings/data-export`** — the **export** surface (`settings/data-export/page.tsx` → `settings/data-export-card.tsx`): one button → PIPEDA ZIP.
> - **The core sub-flow is NOT "upload → map columns → preview → commit."** The live entity wizards are **`INPUT → [PROCESSING] → PREVIEW → COMMIT/DONE`** with **no explicit column-mapping step** — Henry classifies whatever shape the operator drops/pastes, then the operator edits an ephemeral preview table per row. (PATTERNS §16: "Preview is ephemeral. No staging table.") **Column-mapping does exist in this codebase — but in the *bank/COA* importers** (`bank-import/bank-import-flow.tsx`: "detected preset / columns / date format with a confidence badge… override any column", mirroring `coa-mapping-panel.tsx`), not the entity importers. **Flag this as the central current-vs-target tension** (Open Questions §1).
> - **Pattern / actions:** PATTERNS **§16 AI-assisted entity import** (the recipe + the 5 phase wizards + `import_batches` provenance + rollback), **§1 upload zones** (`contacts/intake-dropzone.tsx` is the shared dropzone every wizard reuses), §3 confirm dialogs (the rollback AlertDialog), §5 `{ ok, error }`, §6 empty states, §7 status badges + `src/lib/ui/status-tokens.ts`, §17 payment sources (receipt wizard's "Paid by" + label-card), §21 receipt thumbnails, §23 tenant-tz dates. Server actions: `onboarding-import.ts` (customers), `-projects.ts`, `-invoices.ts` (frozen money math), `-receipts.ts` (per-file OCR fan-out), `-photos.ts`, `-time-entries.ts`; per-entity dedup at `src/lib/<entity>/dedup.ts`; export at `src/server/actions/export.ts`. Migrations: `0185_import_batches.sql` (+ `_import_batch` FK per entity: `0186` projects, `0188` expenses, `0209` photos, `0210` time entries; `0187` invoices = frozen-math), `0015_data_exports.sql`.
> - **Parent brief:** `docs/ux/briefs/settings.md` graduates **"Import data"** to its own flow (this doc) and notes the export sits in the Data & tools group (owner). Siblings: `customer-documents.md` (the `<CustomerDocument>` shell pattern — unrelated, but the same "upload zone" family), `expenses.md` (single-receipt form shares §17 payment sources + the receipt OCR path), `contacts.md`/`client.md` (the customer entity the importer lands).
> - **Foundation (target layer):** Positioning `5bfa59be`, Object Model `b4d880be`, Workflow Library `e0263cc3` (Day-1 onboarding), Role × Object Matrix `03b1ccf4`, Design System Map `f9bf30bf`, IA/Nav `6529e9ae`. Design system: `DESIGN.md`, `PATTERNS.md`, `src/app/globals.css` (the warm **"Paper"** palette is **live**), `components/ui/`, `status-tokens.ts`.
>
> **How to use:** render the **import hub** (desktop + mobile), the **canonical wizard** in each of its stages (input · preview-with-decisions · processing-for-file-piles · done), the **imports/rollback list**, and the **export card** — then run `heyhenry-design-critique`. The redesign is **structural + Paper restyle, not a rebuild** — these flows are wired and shipping. Feeds Dev cards on the Ops `dev` board, tag `epic:ux-redesign`.
>
> **Conventions (hard):** Paper + `status-tokens` (one meaning → one colour); **rust is the single accent** — used for the primary CTA + the active decision-toggle segment, nothing else; **`✦` only on real Henry touchpoints** — Henry classification/extraction/dedup, labelled, operator confirms every row before commit; **"client" not "homeowner"**, **"category" not "bucket"**; Canadian (GST/HST, frozen historical tax, CAD); ≥44px mobile targets.

**Object:** `import_batches` (the provenance + rollback record) over the entities it lands — Customer · Project · Invoice · Expense(receipt) · Photo · TimeEntry; plus `data_exports` (the ZIP archive record). Not one object — **an operator workflow (Day-1 onboarding + ongoing top-up) that writes a provenance row over many entity types.** · **Workflow stage:** onboarding / data migration (Workflow Library "Day-1"). · **Roles:** owner + admin (operational); **export = owner** (PIPEDA/MFA-gated, see `guardMfaForSensitiveAction`); member/worker/client never. · **Primary action — import:** drop or paste your data, confirm Henry's read, bring it in. **Primary action — export:** download everything as a ZIP.

---

## Purpose
Get a contractor's existing book of business — customers, jobs, invoices, receipts, photos, hours — **into** HeyHenry on Day 1 without manual re-entry, and let them get it all **back out** any time (portability / "I'm in control of my data"). This is a **first-impression showcase** (PATTERNS §16: "the bar is high… let the model's actual reasoning be the show"): the magic is that Henry reads *whatever shape* the data is in (a QuickBooks export, a Jobber CSV, a pasted list, a pile of receipt photos) and the operator just **reviews + confirms** rather than mapping spreadsheet columns. Every batch is **provenance-stamped and one-click reversible**, which is what makes "just try it" safe.

---

## Layout *(compose from `card`, `table`, `badge`, `button`, `input`, `select`, the shared `IntakeDropzone`, `AlertDialog`)*

### A. Import hub — `/import` *(the entry; what Settings ▸ "Import data" opens)*
1. **Header** — `✦ Day-1 onboarding` eyebrow + "Bring your data in" + one-line "Henry handles whatever shape your data is in" promise.
2. **Tile grid** — `grid-cols-1 md:grid-cols-2`, one `Card` per importable entity: icon · title · blurb · example-formats line · trailing `→`. Each card is a `Link` to its wizard; hover `bg-muted/40`.
3. **Recommended-next chip** — the earliest still-empty tile gets a rust-tinted **"Start here"** pill; already-populated tiles get an emerald **"Already added"** pill (server counts each entity). This is the only place rust appears on the hub.
4. **Imports-list deep-link strip** — a bottom `card`: "Already brought something in?" + `{n} active →` linking `/settings/imports`.

### B. Entity wizard — `/{entity}/import` *(single-page, stage-swapped; the heart of the feature)*
The page is a narrow column (`max-w-4xl`, `max-w-5xl` for invoice/receipt/time which have wider tables) with `DetailPageNav` back-link + an entity-specific header, then the wizard which swaps between stages:
- **Stage 1 — INPUT.** Two cards: an **Upload** card wrapping the shared `IntakeDropzone` (drag-drop + click; `accept` scoped per entity — `.csv,.tsv,.txt` for text entities, `.pdf,image/*` for receipts, image types for photos), an **"or"** divider, and a **Paste a list** `Textarea` (text entities only) with a shape-agnostic placeholder. Primary button: **`✦ Read it`** (rust).
- **Stage 2 — PREVIEW + DECIDE** (text entities go straight here after parse). A **summary chip strip** ("Henry found N customers" + `{n} new / {n} merged / {n} skipped` badges), then the **decision table**: one row per proposed record with **inline-editable cells** (name/vendor/money/date as `input`s styled borderless-until-hover), a **Match** column (dedup tier — strong matches in **amber**, "New to you" otherwise), and a right-aligned **3-segment Decision toggle** (`Create · Merge · Skip`; active segment = rust; Merge disabled when no match). Below: an optional **"Note for the audit trail"** `input` + **`Bring them in →`** (disabled until ≥1 create/merge, and until any hard-blocking errors clear).
- **Stage 2′ — PROCESSING** (file-pile entities only — receipts, photos). A progress card ("Reading receipt 3 of 50…" + a `role="progressbar"` bar + an error count badge) with a live-streaming list of files as each OCR/upload returns (vendor · amount, or a red "couldn't read" line). Then it lands on PREVIEW with the parsed rows.
- **Stage 3 — DONE.** Centred success card: emerald check disc + "All done." + the `{created} new, {merged} merged, {skipped} skipped` counts + **"See your {entity}"** (rust) and **"Import another"** (outline) buttons.

### C. Imports list — `/settings/imports` *(history + rollback)*
1. **Header** — "Imports" + "Every batch of data Henry has brought into your account, newest first. Roll one back if it went wrong."
2. **Batch rows** — a stack of `card`s, each: the **kind** (capitalized) + count badges (`{n} new` / `{n} merged` / `{n} skipped` + side-effect badges like `+ 3 new customers` for project/invoice imports) + optional **note** + a meta line (`source filename · timestamp by email`). Rolled-back batches render at 60% opacity with an **amber "Rolled back"** badge + a "Rolled back {when} by {who}" line. A right-aligned **`↺ Roll back`** outline button (hidden once rolled back) opens an **AlertDialog** with kind-specific consequence copy ("We'll soft-delete the N customers Henry created… your existing customers stay put").
3. **Empty state** — `History` icon + "Nothing imported yet" + a row of entity quick-start buttons linking each wizard.

### D. Export card — `/settings/data-export`
A single `Card`: `FileArchive` icon + "Data export" + "Download all your data as a ZIP file (PIPEDA compliance)." + a full-width **"Export all my data"** button (spinner → opens the signed URL) + a "Last export: {date}" link when a non-expired archive exists (7-day signed-URL expiry).

---

## Progressive disclosure
- **Snapshot:** the **hub tile grid** (what can I bring in, what's the recommended next step) and, for history, the **batch-row count badges**.
- **Operational:** the **wizard preview table** — the operator's working surface; per-row Create/Merge/Skip + inline edits.
- **Detail:** an individual **inline-edited cell** (rename a customer, fix an OCR'd amount, re-pick a category/worker/payment-source); the **rollback consequence dialog**.
- **Audit:** the **imports list** *is* the audit trail (who/when/what/source-file per batch + the optional note); the **`data_exports`** record (last-export link). The org-wide `/settings/audit` log records the batch + export events too.

---

## Henry intelligence touchpoints *(labelled, operator confirms — never auto-commits; not chat)*
- **`✦` Classify-from-any-shape** *(the headline).* On **Read it**, Henry (gateway `runStructured`, task `onboarding_<entity>_classify`, **pinned to Sonnet 4.6** — Day-1 quality moment, cost irrelevant) turns a raw file/paste into a typed proposal array. Surfaced as the populated preview table; the button reads **"Henry is reading…"** while it runs. **Nothing is written** until the operator hits *Bring them in*.
- **`✦` Per-field extraction.** Receipts/invoices: Henry pulls **vendor · amount · GST · date · status** (receipts also a suggested **category** — shown as "Suggested by Henry" under the cell) from OCR/text. Every extracted value is an editable cell; operator-edited totals **re-derive pre-tax locally**.
- **Deterministic dedup (not AI — say so).** AI *proposes*; `src/lib/<entity>/dedup.ts` *decides* matches by tier (email > phone > name+city > name). The **Match** column shows the tier + the existing record's name; strong matches default the row to **Merge**. This is rules-based — don't badge it `✦`.
- **`✦` Worker / customer resolution.** Time entries: Henry matches each row's worker to a real team member; unmatched rows **fall back to the importing user** with an operator-overridable picker (can't auto-create auth users). Projects/invoices: the **cross-entity FK** (project→customer, invoice→customer+project) resolves to matched-or-create-new, side-effect rows committed first under the **same batch_id**.
- **Background tagging.** Photos: Henry's AI tagger picks up imported photos **in the background** post-commit — the operator labels nothing by hand.
- **Undo is the safety net.** Every commit writes an `import_batches` row + stamps each created entity `import_batch_id`; **Roll back** soft-deletes (never hard-deletes — rows may already be referenced) and is **always available** on the imports list. Frame the whole feature around this: Henry acts, you confirm, and you can always reverse the whole batch.

---

## Role variations
- **Owner:** full access to all wizards, the imports list (+ rollback), **and export** (export is owner-gated + MFA-guarded for sensitive action).
- **Admin:** all wizards + imports list + rollback (operational). **Export:** gate to owner per the Data & tools matrix — confirm in Open Questions.
- **Member:** **no** — import/export is an owner/admin onboarding surface; the Settings nav must not advertise it to members (ties to `settings.md` Open Q §1, the nav role-filter gap).
- **Worker (`/w`) / Client (portal):** **never.** No import, no export, no batch history. (The customer portal never sees provenance, other customers, or internal notes — N/A here since this is dashboard-only.)

---

## Mobile vs desktop
- **Hub:** tiles stack to one column (`grid-cols-1`) — fine on mobile.
- **Wizards:** **input + done stages are mobile-friendly** (dropzone, paste, success card) and matter on mobile — a contractor **dropping receipt photos straight from the phone camera** is a real flow (receipt dropzone accepts `image/*`; images are client-compressed before upload). **The preview decision tables are desktop-first work** — wide multi-column grids (receipt = 9 columns). On mobile, the table must reflow to **stacked per-row cards** (label: value pairs + the decision toggle + match) rather than h-scroll a 9-col table; honour PATTERNS §18 (set `grid-cols-1` at base, watch `min-width: auto` truncation). Reviewing/correcting a 200-row import is desktop thinking-work; capturing the pile is mobile.
- **No offline** — import/export is online-only (gateway + storage round-trips). The receipt fan-out is **resilient to per-file failure** (a hung/failed file becomes a red row, the batch continues), which is the closest analogue to flaky-connection tolerance.

---

## Financial / Canadian
- **Frozen historical tax (non-negotiable).** Imported invoices **freeze `amount_cents` + `tax_cents` at the source's recorded values** — never recompute against today's rate (PATTERNS §16; `0187`). The invoice wizard header says it plainly: "your 2024 BC invoices keep their original 5% even if rules change later." The preview shows subtotal / tax / total as editable money cells; the `import_batch_id IS NOT NULL` flag is the contract downstream money code must respect.
- **GST on receipts.** Receipt OCR extracts **GST/HST** separately from the total; operator-edited total re-derives pre-tax. Vendor **GST number** is captured when present.
- **CAD throughout**, `formatCurrency` cents-based money cells, tabular-nums alignment.
- **Payment sources / e-Transfer parity.** Receipt rows carry a **"Paid by"** source (PATTERNS §17) — business card (by last-4), Personal-reimbursable, Petty cash; an OCR'd-but-unlabelled card gets an inline **"Label ····NNNN"** affordance that splices the new label across every sibling row in the batch. (No Stripe/Interac *transaction* here — import is historical record-keeping, not collection.)
- **No holdback** (dropped). T5018 / year-end live in the out-of-scope `/bk` bookkeeper portal.
- **Export = PIPEDA portability** — the ZIP bundles every tenant-scoped table as CSV; owner-only + MFA-guarded.

---

## States
- **Empty (hub):** all tiles show their blurb; the first empty entity gets "Start here." If every entity is populated → a "you can still re-import to top up — Henry dedup's everything" note.
- **Empty (imports list):** `History` icon + "Nothing imported yet" + entity quick-start buttons.
- **Empty (export):** the card with no "Last export" line — just the export button.
- **Input (wizard):** dropzone idle + paste empty; `Read it` disabled until a file or paste exists. Drag-over uses the canonical `border-primary bg-primary/5` (PATTERNS §1).
- **Parsing / Henry-reading:** the `Read it` button shows a spinner + "Henry is reading…" (text entities); file-pile entities switch to the **PROCESSING** stage with the per-file progress bar + streaming list.
- **Mapping:** *— no live mapping stage in the entity wizards (Henry-classify replaces it). If the column-override fallback from Open Q §1 ships, it slots **between INPUT and PREVIEW** as an optional "Henry guessed these columns — fix any" panel, mirroring `bank-import-flow`'s confidence-badged override table.*
- **Preview:** the populated decision table; per-row Create/Merge/Skip; summary chips; **hard-block errors** surface here — e.g. receipts/invoices with a missing amount or date render a red **"N missing money"** badge and **disable commit** with an inline instruction to fill or skip those rows. Failed-parse rows render at 60% opacity, red error text, forced to Skip.
- **Committing:** `Bring them in` → spinner + "Bringing them in…"; on success → DONE with counts; `router.refresh()` so the imports list reflects the new batch.
- **Error:** every action uses `{ ok, error }` + a `sonner` toast ("Henry didn't recognize any customers in that. Try a different format?"; "Receipt timed out — retry this one."). Per-file OCR failures never fail the whole batch.
- **Rollback:** the AlertDialog with kind-specific consequence copy; on confirm → toast ("Rolled back. 12 customers removed.") + the row dims with the amber "Rolled back" badge.
- **Loading (lists):** the imports list + hub are server-rendered; use `skeleton` rows if a client refetch is introduced.

---

## Subscreen inventory *(enumerate every surface — light = inline one-liner, heavy = graduated)*

**Routes / pages (the spine):**
- **`/import` hub** — *spec'd above (Layout A).* The single entry the Settings nav opens.
- **`/settings/imports` list** — *spec'd above (Layout C).* History + rollback.
- **`/settings/data-export` card** — *spec'd above (Layout D).* Single-action.
- **6 wizard routes** (`contacts|projects|invoices|expenses|photos|time/import`) — each = `DetailPageNav` + header + the wizard. **Two wizard shapes graduate as the design's hero deliverables** (render both): **(i) text/single-shot** (canonical = customer; projects/invoices/time share it, with extra columns) and **(ii) file-pile fan-out** (canonical = receipt; photos share it). Spec both shapes through every stage; the other four follow the same skeleton with entity-specific columns (below).

**Stages within a wizard (sub-flow — the core of the feature):**
- **INPUT** · **PROCESSING** (file-pile only) · **PREVIEW+DECIDE** · **DONE** — *spec'd inline (Layout B).* Stage-swap, not routes; preview state is ephemeral (no staging-table sub-route).

**Per-entity column variations in the PREVIEW table (light — one line each):**
- **Customers:** Customer (name, inline notes) · Contact (email/phone) · City · Match · Decision.
- **Projects:** project name · linked-customer (matched/create-new FK column) · description · Match · Decision.
- **Invoices:** customer · project (FK) · date · subtotal · tax (frozen) · total · **status pill** (draft/sent/paid/void) · Match · Decision.
- **Receipts:** file · vendor · date · amount · tax · **category** (Henry-suggested `select`) · **Paid by** (payment-source pill / label-card) · Match · Decision.
- **Photos:** project picker (server-populated) · the dropped images · commit (no per-row decision table — attach-to-project + background tag).
- **Time entries:** worker (matched/fallback-to-importer picker) · project · date · hours · Match · Decision.

**Modals / dialogs (light — inline-spec):**
- **Rollback confirm** (`AlertDialog`, PATTERNS §3) — trigger: `↺ Roll back` on a batch row · content: kind-specific consequence + "soft-delete = recoverable" reassurance · actions: Cancel / Roll back (spinner) · states: pending-disabled.
- **Label-card dialog** (`LabelCardDialog`, PATTERNS §17) — trigger: an unlabelled OCR'd card in a receipt row · content: name-this-card form · action: save → splices the label across all same-last-4 rows.

**Sub-components reused (not new surfaces):** `IntakeDropzone` (§1), `PaymentSourcePill` + label affordance (§17), the 3-segment `DecisionToggle` (repeated across wizards — **candidate to extract to a shared primitive**, see Open Q §4), `MoneyCell`, `CategoryCell`, `SourceCell`.

**Out of scope / does not exist (don't invent):** a **cost-catalog / pricebook / materials CSV importer** — *there is none* (the task's "cost-catalog via CSV" example has no entity wizard; `catalog_items` is **export-only**, and Pricebook is GC-hidden per `settings.md`). A **selective / format-choosing export** — export is currently **all-tables-ZIP, one button** only. A **column-mapping UI in the entity wizards** — see Open Q §1.

---

## Accessibility
- **Decision toggle** is the key control — it must be reachable + operable by keyboard (it's three `<button>`s today; ensure roving focus + a group label like "Decision for {name}"), and **not colour-only**: the active rust segment needs a non-colour cue (the filled state + text already differ; verify contrast of rust-on-cream and the disabled "Merge" affordance).
- **Status + match** never rely on colour alone — amber "matched" carries the tier label text; status pills pair colour with the status word (and the invoice `StatusPill` should adopt `statusToneClass` + `statusToneIcon` for the colour-blind glyph — see Open Q §3).
- **Progress bar** already exposes `role="progressbar"` + `aria-valuenow/min/max` + a label — keep it; announce completion to SRs.
- **Editable cells**: the borderless-until-hover inputs must keep a **visible focus ring** (don't suppress focus with the hover-only border trick) and real labels/`aria-label`s per column.
- **Dropzone**: clickable + keyboard-activatable, with a labelled file input behind it; drag-over state has a text/icon cue, not just the tint.
- **Targets ≥44px** on mobile — the decision-toggle segments and per-row controls are small on the desktop table; the mobile stacked-card reflow must size them up.
- **Rollback dialog**: focus trapped, Esc cancels, the destructive action is clearly worded ("soft-delete = recoverable").
- WCAG 2.2 AA contrast on every Paper surface, incl. the muted-foreground meta lines and the `text-[10px]` chips (verify they clear AA at that size or bump them).

---

## Open questions *(assumptions + current-vs-target deltas this screen surfaces)*
1. **The "map columns" gap — the headline delta.** The task framed the flow as *upload → **map columns** → preview → commit*, but the entity wizards have **no column-mapping step** — they Henry-classify any shape, by design (PATTERNS §16: "no staging table"). Column-mapping **does** exist as a sibling pattern in `bank-import-flow.tsx` / `coa-mapping-panel.tsx` (confidence-badged, override-any-column). **Decision needed:** is Henry-classify-only the intended UX (keep as-is, it's the showcase), or do we add an **optional column-override fallback** for when Henry guesses wrong on a wide structured CSV (slot it between INPUT and PREVIEW, reuse the bank-import override pattern)? Today's answer is "no mapping"; flagging because the brief was written expecting one.
2. **Three surfaces, one mental model — consolidate the IA?** Import lives at `/import`; its history/rollback lives at `/settings/imports`; export at `/settings/data-export`. The Settings nav "Import data" jumps *out* of settings to `/import`, while "Data export" stays *in* settings. Should the hub, history, and export unify under a single **Settings ▸ Data** destination (tabs: Import · History · Export), or is the current split (onboarding hub in the app, admin history/export in settings) intentional? Recommend a quick IA confirm with `settings.md`.
3. **Status-token + rust-accent drift.** The invoice wizard's `StatusPill` uses **ad-hoc tone classes** (`bg-emerald-100`, `bg-blue-100`) instead of `statusToneClass` from `status-tokens.ts` — and the "matched" amber + emerald success-disc are hand-rolled. Restyle to **route every status colour through `status-tokens`** and **reserve rust strictly for the primary CTA + active decision segment** (audit the wizards for stray accent use). *(Code follow-through → a Dev kanban card, per house rule.)*
4. **`DecisionToggle` is duplicated** across `customer-import-wizard`, `receipt-import-wizard`, `invoice-import-wizard`, etc. — extract to one shared primitive in the same restyle pass (it's the most-repeated bespoke control in the feature). Surface to PATTERNS if extracted.
5. **Export is thin vs. the import showcase.** Today: one button, all-tables ZIP, owner+MFA. Is a **selective export** (pick entities / date range / format) or a **"prep your accountant's package"** (Henry-curated subset) on the roadmap, or does PIPEDA-dump-only suffice for V1? Assumed sufficient — confirm.
6. **`/settings/imports` kind-count vs. reality.** The page query types `kind` as only `customers|projects|invoices|expenses`, but the list component + hub handle **6 kinds** (incl. `photos`, `time_entries`) and the empty state links all six. Minor type/coverage drift to reconcile in code (not a design blocker, but the rollback list should render photo/time batches correctly).
7. **Terminology check.** Wizard copy says "customer" (the allowed data-model term) — correct; ensure no "homeowner" leaks into any import/export copy, and the receipt categoriser says **"category," never "bucket."**
