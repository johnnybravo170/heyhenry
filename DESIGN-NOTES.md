# HeyHenry — App Design System Notes

Companion to `DESIGN.md`. `DESIGN.md` is the portable design system Open Design ingests (and any other AI design tool that reads a 9-section schema). This file is the *bridge* between that abstract system and the actual codebase — where tokens live, what components exist, what surfaces we're designing, and how the redesign lands back in code.

Read this before working on the app's UI; read `DESIGN.md` if you're feeding a design tool.

---

## 1. Stack Readout

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.2.4**, App Router, React 19.2.4 |
| Package manager | **pnpm** |
| Styling | **Tailwind CSS v4** (CSS-first config — no `tailwind.config.*` file) + `tw-animate-css` + `tailwind-merge` + `class-variance-authority` |
| Component library | **shadcn/ui v4** (style: `radix-nova`, baseColor: `neutral`), Radix UI primitives, **lucide-react** icons |
| Data | **Supabase** (`@supabase/ssr`) + **Drizzle ORM** (`drizzle-orm` + `postgres`) |
| Forms | `react-hook-form` + `@hookform/resolvers` + **zod** |
| State / themes | `next-themes` (light/dark) |
| Charts | **recharts** |
| Drag-and-drop | **`@dnd-kit`** |
| AI | `@anthropic-ai/sdk`, `@google/genai` |
| Payments | Stripe (`@stripe/*`) |
| Email | Postmark + Resend |
| Voice / SMS | Twilio + `ws` |
| Monitoring | Sentry (`@sentry/nextjs`) |
| Lint / format | **Biome 2.4** |
| Tests | Vitest (unit), Playwright (e2e) |

Note from `AGENTS.md`: "**This is NOT the Next.js you know**" — Next 16 has breaking changes. Read `node_modules/next/dist/docs/` before writing Next code.

---

## 2. Where Tokens Live

`src/app/globals.css` is the single source of truth. Tailwind v4 reads `@theme inline { ... }` to bind Tailwind utility names to the CSS variables defined below in `:root` and `.dark`.

The shadcn-conventional variable names are all present: `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--accent`, `--muted`, `--destructive`, `--border`, `--input`, `--ring`, sidebar-* variants, `--chart-1..5`, `--radius`, plus `--font-sans` / `--font-mono` (fonts come from `next/font` in `layout.tsx`).

**Current state (as cloned):** the variables are still set to shadcn's neutral default. `--background` is pure white; `--primary` is near-black; charts are grayscale; nothing is on-brand yet. The brand layer hasn't been applied to code.

**Target state:** swap the variables in `:root` to the Paper palette in `DESIGN.md` (and a dark-mode counterpart). When Open Design produces a screen we like, the changeover is a single-file edit — `globals.css` — plus whatever the design tool finds in component files that overrides the variables.

Proposed light-mode token mapping (drop-in replacement for the `:root` block):

```css
:root {
  --background: oklch(0.964 0.005 95);   /* #F7F5F0 paper */
  --foreground: oklch(0.085 0 0);        /* #0A0A0A ink */
  --card: oklch(1 0 0);                   /* #FFFFFF surface */
  --card-foreground: oklch(0.085 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.085 0 0);
  --primary: oklch(0.085 0 0);            /* ink black — buttons */
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.97 0.003 95);      /* near-paper for chips */
  --secondary-foreground: oklch(0.085 0 0);
  --muted: oklch(0.97 0.003 95);
  --muted-foreground: oklch(0.45 0 0);    /* #6B6B6B */
  --accent: oklch(0.585 0.155 38);        /* #C2410C rust */
  --accent-foreground: oklch(1 0 0);
  --destructive: oklch(0.485 0.18 28);    /* #B91C1C */
  --border: oklch(0.085 0 0 / 0.08);      /* hairline */
  --input: oklch(0.085 0 0 / 0.12);
  --ring: oklch(0.085 0 0 / 0.35);
  /* Sidebar — slightly LIGHTER than body, deliberate */
  --sidebar: oklch(0.972 0.004 95);       /* #FBFAF6 */
  --sidebar-foreground: oklch(0.085 0 0);
  --sidebar-primary: oklch(0.085 0 0);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.945 0.006 92); /* #EFECE4 active */
  --sidebar-accent-foreground: oklch(0.085 0 0);
  --sidebar-border: oklch(0.085 0 0 / 0.08);
  --sidebar-ring: oklch(0.085 0 0 / 0.35);
  /* Charts: status-color-led, not grayscale */
  --chart-1: oklch(0.585 0.155 38);       /* rust */
  --chart-2: oklch(0.48 0.12 250);        /* blue */
  --chart-3: oklch(0.55 0.13 145);        /* ok green */
  --chart-4: oklch(0.55 0.12 65);         /* warn amber */
  --chart-5: oklch(0.5 0.15 25);          /* danger red */
  --radius: 0.625rem;                     /* 10px — unchanged */
}
```

OKLCH values approximate the brand-package hexes; verify in browser and tighten. Dark mode tokens are TBD — propose them once the light surface lands.

---

## 3. Components Inventory

`src/components/ui/` — shadcn primitives (kept stock; `lint-staged` exempts them):

`alert-dialog · badge · button · card · checkbox · collapsible · command · dialog · dropdown-menu · form · hover-card · input-group · input · label · money · popover · rich-text-display · rich-text-editor · select · separator · skeleton · sonner (toasts) · table · tabs · textarea`

Note the **custom `money.tsx`** primitive — that's our currency component. Anything money-related should compose this; don't roll your own.

`src/components/layout/` — app shell:

`header · sidebar · admin-header · admin-sidebar · detail-page-nav · feedback-button · nav-icon · nav-link · quick-log-expense-button · quick-log-time-button · workspace-switcher`

The split (default vs `admin-*`) reflects the role-segmented route groups below — admin gets its own chrome.

`src/components/features/` — domain components, organized by area. Each is a directory of related components:

`account · admin · bank-import · bank-review · billing · business-health · calendar · change-orders · checklist · contacts · customers · dashboard · expenses · inbox · invoices · jobs · lead-gen · leads · memos · messages · onboarding · payment-sources · photos · portal · projects · quotes · referrals · settings · shared`

The redesign surface is mostly under `features/` — these are the screens that need TLC.

Other top-level dirs: `branding/` (logos, marks), `charts/` (recharts wrappers), `chat/` (Henry chat UI).

---

## 4. Route / Surface Inventory

`src/app/` uses Next 16 App Router with route groups by role:

| Group | Purpose | Folders inside |
|---|---|---|
| `(dashboard)` | Operator/contractor main app | `business-health · calendar · checklists · contacts · dashboard · expenses · import · inbox · invoices · jobs · photos · projects · quotes · referrals · settings · time · todos` |
| `(admin)` | Internal admin / platform | `admin/` |
| `(auth)` | Login / signup | — |
| `(bookkeeper)` | Bookkeeper portal | — |
| `(public)` | Public pages (quotes, invoices, change orders the customer sees without login — per UX Principle #2) | — |
| `(worker)` | Crew / field worker view | — |

**Primary redesign target (per earlier conversation):** the **project management area** — `(dashboard)/projects/` and `(dashboard)/jobs/`. Calendar, invoices, business-health follow.

The Claude Design handoff bundle in `/Claude/heyhenry-brand/hey-henry-app/` already prototypes the project-view redesign at a high level — useful as a starting reference for the same surface in Open Design.

---

## 5. Patterns to Honor

`PATTERNS.md` in the repo root (53KB) catalogs reusable patterns: upload zones, customer pick-or-create, confirm dialogs, inline edits, status badges, empty states, tabs, server-action result shape. **Read it before designing a screen** — the right move is usually composing an existing pattern, not inventing a new one.

If a new flow earns standardization, update `PATTERNS.md` in the same change. If you change one instance of a pattern, surface the siblings to the user for "should I update these too?" decisions per AGENTS.md.

---

## 6. Codebase Conventions That Affect Design

From `AGENTS.md`:

- **Timezones.** Runtime tz is UTC; tenants have their own tz. Server: use `formatDate(iso, { timezone })` from `src/lib/date/format.ts`. Client: `useTenantTimezone()` from `src/lib/auth/tenant-context.tsx`. Any date or time you put in a mock or design must be a *tenant-tz value* in real life. Don't propose UI that exposes UTC.
- **Migrations.** Use `supabase migration new <slug>` to get a timestamp-prefixed file. (Relevant only if a redesign needs new columns.)
- **Demo tenant for manual QA.** Overflow Test Co (`7098bd96-9cdd-47af-a412-3679af4cb536`), flagged `is_demo`, suppresses outbound email/SMS. Use this tenant for screenshots of real-data states.
- **Worktrees.** `bash scripts/setup-worktree.sh` to symlink env files when working in a new worktree.

---

## 7. Working with Open Design (the AI design tool)

Open Design is self-hosted (Docker or `pnpm tools-dev`), source at `/Claude/open-design/`. It ingests:
- A **design system** (`DESIGN.md`) — selected from a dropdown
- A **skill** (`SKILL.md`) — selected from a dropdown (Prototype / Deck / Template / Design system)
- A **prompt** — what to make

It generates an HTML `<artifact>` and renders it live. Save to disk writes under `.od/artifacts/<timestamp>-<slug>/index.html`. There's a **handoff bundle** export that Claude Code can pick up — same pattern as the Claude Design loop we already used.

**To make HeyHenry available in the design-system dropdown:** the `DESIGN.md` next to this file is symlinked into `/Claude/open-design/design-systems/heyhenry/DESIGN.md`. Refresh Open Design and "HeyHenry" should appear under the "Trade Tools" category.

**Recommended skill for app screens:** `dashboard`. For marketing pages: `saas-landing`. For pricing comparison: `pricing-page`.

---

## 8. The Loop: Brand → Design → Code

```
/Claude/heyhenry-brand/heyhenry-brand-package.md
   ↓ informs
/Claude/heyhenry-app/DESIGN.md
   ↓ ingested by
Open Design (claude.ai/design, or self-hosted at localhost:7456)
   ↓ generates
HTML/JSX prototype + handoff bundle
   ↓ handed off to
Claude Code, working in /Claude/heyhenry-app/
   ↓ produces
Real diffs to the codebase: globals.css token swap, component edits, new screens
```

The closed loop: brand is the why, DESIGN.md is the what, Open Design + Claude Code is the how. Each layer points down; nothing reaches up. When the slogan or palette changes, only the brand package needs editing — DESIGN.md picks it up next time it's re-authored, and Open Design picks it up next time it's loaded.

---

## 9. Open Items / Next Moves

- **First Open Design run:** generate the project view (`(dashboard)/projects/[id]`) with real-data screenshots from the demo tenant fed in as context. Lower-stakes first; refine before moving on.
- **Dark mode tokens:** not yet drafted. Defer until light surface lands and the contrast pairs are tested in real screens.
- **Component-level tokens for shadcn primitives:** the stock components.json has `style: "radix-nova"`. Once the new tokens are in, we may want to re-run `pnpm shadcn add <component>` for a few primitives to pull updated visual defaults — or just edit the `cva` variants by hand. Decide later.
- **Slogan & imagery:** both under review (slogan in brand package §2; "late-night bills" imagery in brand package §9). UI work doesn't need them resolved, but marketing/onboarding screens will.
