# OD Brief — Closeout photo-gallery share (`/g/[handle]`)

> **Grounded in:** `src/app/g/[handle]/page.tsx` (the public gallery — token-gated, no auth, `force-dynamic`), `src/lib/photos/share-links.ts` (`generateShareToken` 48-bit base64url, `slugify`, `buildShareUrl`, `parseShareHandle`, **`getOrCreateShareLink`** idempotent-per-scope, `lookupShareLink` revoke+expiry checks, `recordShareLinkView`), `src/lib/photos/gallery-query.ts` (**`loadGalleryForJob`** — the data source), `src/lib/db/schema/photo-share-links.ts` (DDL `0041_photos_v2`). Data: **`photo_share_links`** — `token` (unique, the key), `slug` (cosmetic), **`scope_type`** ∈ job_full | job_live | album | pair_set | single, `scope_id` (polymorphic), `label`, `recipient_email`/`phone`/`name`, `expires_at`, `revoked_at`, `view_count`/`last_viewed_at`/`last_viewed_ip`. Photos via **`photos`** keyed on **`job_id`** (`tag` ∈ before|after|progress|damage|other shown; **`HIDDEN_TAGS` = concern|serial|materials|equipment never shown**), signed 24h. Tenant brand from `getBusinessProfileAdmin` (logo, website, **reviewUrl**, socials). Vault: Object Model `b4d880be`, Role × Object Matrix `03b1ccf4` (client boundary), Home-Record framework `af12ea51`, Positioning `5bfa59be`. Siblings: **`public-pages.md`** (the no-login brand family this should join), **`home-record.md`** / `/property-record/[slug]` (the *full* closeout package), `project-secondary-tabs.md` (the operator photo gallery this shares from), **`referrals.md`** (the review/referral growth loop this feeds), `showcase.md`/`/showcase/[slug]` (the all-jobs portfolio).
> **How to use:** render **phone-first** (clients open it from an SMS/email link) on the **shared Paper public letterhead** (`<PublicBrandHeader>`, per `public-pages.md` #319) — today it's a bespoke `neutral-*` layout. Generate the client gallery + the operator "share + revoke" affordance, then `heyhenry-design-critique`. Note the **job-keyed scope question** (below) before assuming GC coverage.
>
> **Governing principle — a no-login, brand-carrying "here's your finished job" that doubles as a review/referral engine.** The token is the control (no account, revocable, expirable); the GC's brand (logo + name + socials + review link) carries it; and it ends on a **"Leave {tenant} a review"** CTA — this surface is as much a *growth loop* as a client deliverable. Two hard rules: **internal photos never leak** (`HIDDEN_TAGS` enforced server-side — concern/serial/materials/equipment are stripped regardless of scope), and the gallery shows **only photos + brand**, never cost/margin/other jobs.
>
> **Current vs target:** built + live for **`job_full`** galleries (other `scope_type`s 404). It works, tracks views, respects revoke/expiry, and strips internal tags. **Target (the deltas):** (1) **the job-keyed scope question (headline)** — `loadGalleryForJob` reads the **legacy `jobs` table** (`photos.job_id`); the GC vertical lives on **`projects`/`photos.project_id`**, so for GC this gallery likely doesn't populate. Decide: extend to a projects-keyed path, or route GC photo-sharing through the portal/Property Record. Same PW→GC boundary as `quotes.md`. (2) **Adopt the shared Paper public shell** — it's styled in raw `neutral-50`/`white`/`amber-500`, divergent from the `<PublicBrandHeader>`/`<CustomerDocument>` family (#319/#308). (3) **Lean into the review/referral loop** — make the review ask + social a deliberate, well-placed growth moment, not a footer afterthought. (4) **Scope-type expansion** — `before/after` `pair_set`, `album`, `single`, `job_live` are designed-for but 404. **Flagged** throughout.

**Object:** **Photo Share Link** (`photo_share_links`) — a scoped, no-login, revocable public URL to a set of a job's photos. · **Roles:** **client/public** (the recipient — views, no account; token is the key) · **operator** (owner/admin/member — creates, shares, revokes; `created_by_user_id`). Worker never; no cost roles. · **Primary action (client):** see the finished work + leave a review. **(operator):** share a clean, branded gallery in two taps and ask for the review.

## Purpose
The "show off the finished job" surface. After (or during) a job, the operator shares a single token link; the client opens it on their phone — no login — and sees a calm, branded, tag-organized gallery of their job's photos, ending in a review ask. It's the lightest-weight client photo deliverable (vs the full Property Record) and the most direct **review/referral growth lever** HeyHenry has.

## Layout *(client view — adopt `<PublicBrandHeader>`; compose calm Paper)*
1. **Brand header** — tenant logo + name + "Job gallery" + the job label ("{customer} · {tenant}") + the trust line *"Every photo is timestamped and kept on file by {tenant}."*
2. **Tag-grouped grid** — sections in order **Before · After · Progress · Noted(damage) · Other**; responsive 2/3/4-col; lazy-loaded; optional caption per photo. Empty state: "Photos will appear here as they're captured on the job."
3. **Review CTA** — "Leave {tenant} a review" (→ the tenant's `reviewUrl`, e.g. Google) — the growth moment; make it prominent + well-timed (after the After section), not a buried footer link.
4. **Brand footer** — website + social links (Google/Instagram/Facebook/TikTok/YouTube/LinkedIn/X) + "Shared by {tenant} via Hey Henry" (the platform attribution).

## The operator side — create · share · govern
- **Create:** `getOrCreateShareLink` (idempotent per scope — re-sharing returns the same link). Optional `slug` (cosmetic, from the recipient name), `recipient_email/phone/name`, `label`. Triggered from the project/closeout photo gallery (`project-secondary-tabs.md`) — spec the "Share gallery" affordance there + the copy/send.
- **Govern:** **revoke** (`revoked_at` → link dies) + **expiry** (`expires_at`) + **view tracking** (`view_count`/`last_viewed_at`/`last_viewed_ip` — "viewed 3×, last Tue"). Surface these to the operator so they know it landed.

## Progressive disclosure
- **Snapshot (client):** the branded gallery — the whole point, above the fold.
- **Operational:** the review CTA + socials.
- **Detail:** per-photo captions; (future) lightbox.
- **Audit (operator):** view count + last-viewed; the share link's recipient + created-by.

## Henry intelligence touchpoints *(operator-side; client view is static)*
- **Pick the best** — Henry pre-selects the strongest before/after pairs (favorite/`showcase_score` already exist on photos) so the shared gallery isn't the raw dump.
- **Draft the share + review ask** — Henry drafts the SMS/email that carries the link ("Your photos from {job} — and if you're happy, a quick review helps a ton"); operator sends (outbound to client always human-in-the-loop).
- This is the **referral/review flywheel** — coordinate with `referrals.md`. Per `[[feedback_henry_intelligence_not_chat]]`, Henry drafts/selects; it never auto-sends.

## The client boundary — hard rules
- **`HIDDEN_TAGS` (concern · serial · materials · equipment) are stripped server-side** — internal documentation photos never appear on a public gallery, regardless of scope. Preserve this.
- The gallery shows **only the job's client-safe photos + tenant brand** — never cost, margin, other customers/jobs, or internal notes. (Boundary-audit it the way `public-pages.md` was orchestrator-verified.)
- **Token is the only control** — no enumeration (48-bit random), revocable, expirable. Don't add an authed helper on this route.

## The edges — distinguish from the other photo/public surfaces
| Surface | What it is | vs the `/g/` gallery |
|---|---|---|
| **Portal photo tab** (`public-pages.md`) | Per-project, slug-based, the live project hub | `/g/` is a standalone token share (any recipient), review-oriented, lighter |
| **Property Record** (`/property-record/[slug]`, `home-record.md`) | The full frozen closeout package (phases/decisions/COs/selections/photos/docs) | `/g/` is *just the photos* + a review ask |
| **Showcase** (`/showcase/[slug]`) | The tenant's all-jobs **portfolio** | `/g/` is **one job's** gallery |
| **Operator gallery** (`project-secondary-tabs.md`) | Where photos are captured/tagged/curated | `/g/` is the *output* of sharing it |

## Role variations
- **Client / recipient:** the gallery + review CTA; no account; token-gated. Mobile-first.
- **Operator:** create/share/revoke + view stats; chooses which job, which photos surface (via tags/favorites).
- **Worker / other:** not involved (capture feeds it, but sharing is an operator action).

## Mobile vs desktop
**Mobile-first** — opened on a phone from a text/email link. Big, fast-loading grid; ≥44px review button; lazy images; no pinch-zoom traps. Desktop is the spouse/realtor viewing — keep it clean and wide.

## Financial / Canadian
None on the surface — no money, no tax. The Canadian-trust note is the "timestamped and kept on file" line + the real GC brand. The "via Hey Henry" attribution is a platform-growth signal (keep/drop is a decision below).

## States
- **Empty (no photos yet):** "Photos will appear here as they're captured on the job."
- **Invalid / revoked / expired token:** `notFound()` (404) — clean branded 404, not a leak or a stack trace.
- **Wrong slug:** 302 to the canonical `/g/{slug}-{token}`.
- **Non-`job_full` scope:** currently 404 (future scope types).
- **Loading:** server-rendered + lazy images; signed URLs valid 24h.

## Subscreen inventory
- **Client gallery** (`/g/[handle]`) — **HEAVY → own render** (the brand-carrying client surface).
- **Operator "Share gallery" affordance** — **MEDIUM → spec in `project-secondary-tabs.md`** (the create/copy/send + recipient + revoke/expiry + view-stats controls live on the operator photo tab).
- **Scope-type variants** (`pair_set` before/after · `album` · `single` · `job_live`) — **future → graduate** when built; the route + schema already anticipate them.
- **Lightbox / per-photo view** — **LIGHT → future** (today it's a flat grid).

## Accessibility
WCAG 2.2 AA: photo `alt` from caption/tag (present); tag section headings are real `<h2>`; the review CTA is a clearly-labeled button, not icon-only; ≥44px targets; lazy images keep layout stable (set dimensions to avoid CLS); brand logo has the tenant name as alt; sufficient contrast (the move to Paper must keep the photo grid legible).

## Decisions / Open questions
1. **Job-keyed (`jobs`) vs GC `projects` (the headline).** `loadGalleryForJob` reads the legacy `jobs` table; GC photos live on `projects`. Decide: (a) add a projects-keyed gallery path so GC can share closeout galleries here, or (b) GC photo-sharing routes through the portal / Property Record and `/g/` stays PW-flavored. Foundation/Ops + Coding call — same PW→GC boundary as `quotes.md`.
2. **Adopt the shared public Paper shell** — move off the bespoke `neutral-*` layout onto `<PublicBrandHeader>` so the whole no-login family is one calm brand system.
3. **Review/referral prominence** — elevate the review ask + tie it into the `referrals.md` flywheel; is the review the primary CTA or a soft footer?
4. **"Shared by {tenant} via Hey Henry"** — keep the platform attribution (free growth) or let GCs hide it on higher tiers? Positioning call.
5. **Scope-type roadmap** — which of `pair_set`/`album`/`single`/`job_live` to build next (before/after `pair_set` is the classic contractor share).
