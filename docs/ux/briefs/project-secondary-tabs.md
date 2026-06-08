# OD Brief — Project secondary tabs: Photos (Gallery) · Documents · Notes

> **Grounded in:** the Project Hub tab servers `src/components/features/projects/tabs/{gallery-tab-server,documents-tab-server,memos-tab-server}.tsx` (note: the **Notes** tab's server file is misleadingly named `memos-tab-server.tsx`). **Photos:** `src/components/features/photos/` (`project-photo-gallery.tsx`, `photo-card.tsx`, `photo-upload.tsx`, `photo-tag-select.tsx`, `photo-favorite-button.tsx`, `project-photo-bulk-bar.tsx`, `delete-photo-button.tsx`), query `src/lib/db/queries/photos.ts`. **Documents:** `src/components/features/portal/{document-list,document-upload}.tsx` (shared with the portal), `project-document-type-toggle.tsx`, `home-record-button.tsx` + `home-record-email-button.tsx`, `trade-contacts-list.tsx`, queries `src/lib/db/queries/{project-documents,home-records}.ts`. **Notes:** `src/components/features/projects/project-notes-tab.tsx` (the unified feed) + `src/components/features/memos/memo-upload.tsx`, actions `src/server/actions/project-notes.ts` (`addProjectNoteAction`, `deleteProjectNoteAction`, **`askHenryAboutProjectAction`**). Data: **`photos`** (`tag` ∈ before|after|progress|concern|other; `portal_visibility` ∈ portal|internal **default internal**; `phase_id`; `favorite`/`showcase_score`; `caption`; `memo_id`; bucket `photos`), **`project_documents`** (`type` ∈ contract|permit|warranty|manual|inspection|coi|other; `client_visible` **default true**; bucket `project-docs`), **`project_notes`** (`kind` ∈ text|reply_draft|henry_q|henry_a|artifact; `metadata`), **`project_memos`** (voice → Whisper `transcript` → `ai_extraction`), **`worklog_entries`** (the activity events), `home_records` (the frozen handoff package: `slug`/`pdf_path`/`zip_path`/`emailed_at`). Vault: Object Model `b4d880be`, Role × Object Matrix `03b1ccf4` (the client/portal boundary), Customer Portal module `c3e78671` + Home-Record product framework `af12ea51` (the closeout vision). Siblings: **`project-hub.md`** (the shell that hosts these tabs), `client.md` (the portal/client tab), `calendar.md` (Crew tab), `schedule.md`.
> **How to use:** these are the **secondary** Project Hub tabs — render them in the hub's tab shell (don't re-draw the hub chrome; see `project-hub.md`). Generate desktop + mobile of each tab's hero state, then run `heyhenry-design-critique`. Photos is the one with a real mobile-capture story.
>
> **Governing principle — the project's evidence, memory, and file drawer.** Photos = the **visual proof** of the work; Documents = the **contracts/permits/warranties** drawer (and the seed of the closeout Home Record); Notes = the **project's memory** (what was said, recorded, decided, and what Henry noticed). The through-line that governs all three: **client-visibility is a per-item decision** — photos are *private by default* (`portal_visibility='internal'`), documents are *client-visible by default* but toggleable, and notes are *always internal*. Capture is mobile-first and forgiving; organizing + curating is desktop work.
>
> **Current vs target:** all three tabs are built and live inside the hub. **Photos** — upload + tagged gallery + favorites + bulk bar + portal-visibility toggle. **Documents** — typed file store + the **Home Record** generator (PDF/ZIP, emailable) + trade contacts. **Notes** — a unified chronological feed (operator notes, voice memos, worklog events, intake artifacts) with an inline composer and an **"Ask Henry about this project"** Q&A box. **Target (the delta):** (1) **Paper-palette restyle** — these tabs still use raw `amber-*`/`blue-*` note cards + plain borders, not status-tokens; (2) resolve the **"Ask Henry" inline-chat tension** (see Decisions) against *"Henry is intelligence, not chat"*; (3) **client-visibility legibility** — make "who can see this" obvious at a glance on every photo/doc (it's the #1 trust risk on these tabs); (4) the terminology sweep — Documents copy still says "homeowner," should be **"client."** **Flagged** throughout.

**Objects & primary actions (one per tab):**
- **Photo** (`photos`) — *capture and prove the work; choose what the client sees.* Roles: owner/admin/member full; worker capture-on-assigned; client sees portal-visible only.
- **Project Document** (`project_documents`) — *keep the contracts/permits/warranties in one place; hand them off at closeout.* Roles: full internal; client sees `client_visible` only.
- **Note / Memo** (`project_notes` + `project_memos` + `worklog_entries`) — *capture what happened and ask Henry about the job.* Roles: internal only; **never** client-visible.

## Purpose
The Project Hub's primary tabs answer the money + schedule questions (Overview/Budget/Spend/Labour/Schedule/Billing). These three **secondary** tabs answer the *evidence + memory + paperwork* questions: "show me the photos," "where's the permit," "what did we say about this job." They're lower-traffic than the money tabs but they're where the **closeout package** (Home Record) and the **client-trust boundary** (what's shared) actually live.

## Photos — the Gallery tab
- **Layout:** an upload zone (drag-drop / camera on mobile) above a responsive photo grid. Each `photo-card` shows the image, tag chip, a favorite star, and a portal-visibility indicator. A **bulk bar** appears on multi-select (tag, set portal-visible, delete).
- **Tags:** before · after · progress · concern · other (filter the grid by tag). **Concern** photos are the ones that often become a Change Order or an issue flag — surface them.
- **Visibility:** `portal_visibility` defaults to **internal (private)**. Sharing to the client portal is an explicit per-photo (or bulk) action. *This default is a feature, not a bug — never flip a photo client-visible implicitly.*
- **Phase + favorite:** photos can carry a `phase_id` (groups them into the milestone roadmap) and `favorite`/`showcase_score` (the best ones surface in the portal + Home Record). Photos also attach to receipts (`cost-line-photo-strip`) and memos (`memo_id`) — the gallery is the canonical store.

## Documents — the file drawer + Home Record
- **Layout:** a header ("Documents & warranties"), the **Home Record** card, an upload zone, the document list, then trade contacts.
- **Document list:** typed files (contract · permit · warranty · manual · inspection · **coi** · other) with a **client-visible toggle** (`project-document-type-toggle`) — default visible, hide per-doc. COI (certificate of insurance) is the sub-compliance doc — see the latent-compliance note in `[[project_heyhenry_sub_compliance_latent]]`.
- **Home Record** (the closeout payoff): the frozen, shareable handoff package — phases, photos, selections, decisions, COs, warranties → a permanent `slug` + PDF + ZIP, regenerate anytime (link stays stable), email to the client. This is the "Project Portal becomes Home Record at closeout" vision (`af12ea51`) — the Documents tab is where the operator generates/sends it.
- **Trade contacts:** subs/vendors on the project (read from the project's subcontractors) — a directory, not an editor.

## Notes — the project's unified memory + Ask Henry
- **Layout:** an **inline note composer** (text) + a **voice-memo** dialog (`MemoUpload` → Whisper transcript + AI extraction), an **"Ask Henry about this project"** box, then a single reverse-chronological **feed**.
- **The feed mixes** (one timeline): operator **notes**, **voice memos** (transcript + status), **worklog events** (system/intake), **intake artifacts** (sketch/inspiration/drawing dropped via "Add to project"), and Henry items — **`henry_q`/`henry_a`** (the Ask-Henry Q&A, stored as notes) and **`reply_draft`** (Henry-drafted customer replies, "copy reply"). Each card is typed + deletable.
- **Ask Henry:** `askHenryAboutProjectAction` answers project-scoped questions ("biggest variance risk on this job?") inline. **This is the design tension to resolve** (Decisions #1).

## Progressive disclosure
- **Snapshot:** each tab opens on its hero (the grid / the list / the feed) — no dashboard chrome.
- **Operational:** upload, tag, toggle visibility, add a note, generate the Home Record.
- **Detail:** a photo opens a **lightbox** (`estimate-photo-lightbox` pattern); a memo expands its transcript; an artifact links to the full image.
- **Audit:** the Notes feed *is* the audit trail (worklog events interleaved) — no separate audit surface.

## Henry intelligence touchpoints *(labeled; undoable; never auto-shares to the client)*
- **Photo intelligence (target):** auto-tag (before/progress/concern), auto-suggest phase, draft a client-safe caption — per the Home-Record framework, "a photo without context increases client anxiety." Henry suggests; operator confirms before anything goes client-visible.
- **Memo → structured (built):** voice memo → transcript → `ai_extraction` (the capture-now/clean-up-later loop). Henry classifies; never blocks capture.
- **Ask Henry / reply drafts (built):** project-scoped Q&A + drafted customer replies land in the Notes feed as reviewable items. Drafts are copy-to-send (human-in-the-loop), never auto-sent.

## The edges — adjacent tabs, don't merge
| Surface | Relationship |
|---|---|
| **Selections** (`selections-tab-server`, `project_selections`) | Customer finish choices + allowances — a **distinct** secondary tab; **appears un-briefed** (see Decisions #3) |
| **Messages** (`messages-tab-server`, `project_messages`) | The client thread — separate tab (client/portal territory) |
| **Portal / Client** (`client.md`) | Where shared photos/docs/decisions surface to the client; these tabs decide *what* is shared |
| **Inbox intake** (`intake_drafts`) | "Add to project" drops artifacts/photos/docs that land in these tabs (the apply destinations) |
| **Crew** (`calendar.md`) | The project's roster tab — different object |

## Role variations
- **Owner / admin / member:** full — upload, tag, toggle visibility, generate Home Record, add notes, ask Henry.
- **Worker (`/w`):** **capture** photos on assigned projects (the field story) + voice memos; no document management, no Home Record, no notes-feed curation.
- **Client (portal, no login):** sees **only** portal-visible photos and `client_visible` documents + the Home Record when sent; **never** the Notes feed, internal photos, supplier/COI cost context, or Henry Q&A. *(Current Documents copy says "homeowner" — change to "client.")*

## Mobile vs desktop
*"Mobile = doing work; desktop = thinking work."*
- **Photos are the mobile capture surface** — camera-first upload, offline-tolerant (queue + sync), ≥44px controls; tagging/curation can wait for desktop (capture-now/clean-up-later). Voice memos are also mobile capture.
- **Documents + Home Record + notes curation are desktop work** — file upload, type toggles, generating/emailing the handoff package, reviewing the feed.

## Financial / Canadian
Light-touch — these tabs aren't money surfaces. Relevant primitives: **COI** (insurance) + **permit** + **WCB/warranty** documents are the Canadian-contractor paperwork the Documents drawer must hold cleanly; the Home Record PDF is the client-facing closeout artifact (carries the GC's brand). No CAD/tax math here. **No holdback.**

## States
- **Empty:** Photos — "no photos yet, add some from the field"; Documents — "no documents — contracts, permits, warranties live here"; Notes — the built empty line ("Add a note, record a memo, or drop artifacts via Add to project").
- **Loading:** the hub tab skeleton (`tab-skeleton.tsx`); photo grid + signed-URL fetch get a skeleton.
- **Error:** uploads + note actions return `{ ok, error }` + toast; a failed signed-URL shows a "no preview" tile (already handled in the artifact card).
- **Offline:** Photos/memos capture must queue offline and sync (field surface); document upload + Home Record generation require connection.

## Subscreen inventory
- **Photo lightbox** — **MEDIUM → inline.** Tap a photo → full view + tag/visibility/favorite/delete + caption. Reuse the existing lightbox pattern.
- **Photo upload + bulk bar** — **LIGHT → inline.** Drag-drop/camera; multi-select → tag / set-portal-visible / delete.
- **Voice-memo dialog** (`MemoUpload`) — **MEDIUM → inline.** Record → transcribe → attach photos/category. Trigger: "Voice memo" in the Notes composer.
- **Home Record generate/email flow** — **HEAVY → graduate** to its own render/row. Generate (assemble phases/photos/selections/decisions/COs/warranties → PDF + ZIP + slug) → preview → email to client. This is a real multi-step closeout flow; spec it standalone (ties to the Home-Record product framework `af12ea51`).
- **Ask Henry Q&A** — **MEDIUM.** Inline question → answer card in the feed. Spec the surface but resolve the chat tension first (Decisions #1).
- **Document type toggle / client-visible** — **LIGHT → inline.** Per-doc type + visibility control.

## Accessibility
WCAG 2.2 AA: **portal-visibility must be label+glyph, never colour-only** (it's the trust-critical state); photo tags carry text not just hue; the gallery grid + document list are real semantic lists; lightbox is keyboard-operable + focus-trapped; voice-memo capture has a text fallback (the transcript); ≥44px touch targets for field capture; note cards' delete buttons are labeled.

## Decisions / Open questions
1. **"Ask Henry" inline box vs "Henry is intelligence, not chat."** The Notes tab has an inline Q&A. Per `[[feedback_henry_intelligence_not_chat]]`, don't grow chat surfaces inline/bigger. *Recommendation:* keep the project-scoped Q&A but frame it as a **Henry action that drops an answer into the feed** (which is what it does), not a chat thread to live in — and don't expand it. Confirm with the owner; this is a critique-level call.
2. **The Notes tab's server file is named `memos-tab-server.tsx`** — naming debt; the tab is "Notes." Flag for Coding (rename for clarity), not an OD concern.
3. **Selections appears un-briefed.** `selections-tab-server` (`project_selections`, customer finish choices + allowances) is a real secondary tab not in any brief or the untouched menu. **Surface it as a gap** — recommend a follow-up Selections brief (out of this row's scope).
4. **Client terminology** — Documents tab copy says "homeowner"; apply the `[[feedback_client_not_homeowner]]` sweep → "client."
5. **One row or split?** These three are bundled in one pipeline row + this brief. If OD finds Photos (the mobile-capture story) deserves its own render, graduate it — Documents + Notes are calmer.
