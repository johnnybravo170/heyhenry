# OD Brief — Customer Documents & Pay (the homeowner-facing surface)

> **Grounded in:** `src/app/(public)/view/invoice/[id]/page.tsx` (the **invoice pay surface**, id-keyed), `src/app/(public)/view/[id]/page.tsx` + `quote-approval-form.tsx` (legacy PW quote view), `src/app/(public)/estimate/[code]/page.tsx` + `estimate-render.tsx` + `approval-form.tsx` (estimate approval — code-keyed, has logo), `src/app/(public)/approve/[code]/page.tsx` + `change-order-diff-view.tsx` (CO approval — code-keyed), `src/app/(public)/layout.tsx` (the bare shared chrome), `src/app/(public)/portal/[slug]/page.tsx` (the separate slug-keyed project portal); `lib/invoices/*` (`resolveInvoiceDocFields`, the `pdf_url`=Stripe-link quirk at `invoices.ts:304/331`), `canadianTax`, `public-views.ts` (fire-and-forget `PublicViewLogger`). Vault: Role Matrix `03b1ccf4` (portal boundary), Object Model `b4d880be`, `docs/ux/sacred-path-map.md`. Siblings: **`briefs/estimate.md`** + **`briefs/change-order.md`** (their public-approval sections — this brief defines the shared shell they should adopt), **`briefs/invoices.md`** (operator-side AR; the pay surface is its customer counterpart).
> **How to use:** paste into the OD project, generate hi-fi **desktop + mobile** (homeowners read these on phones), then run `heyhenry-design-critique`. Note: these are **customer-facing** — they carry the GC's brand (logo/name), not the HeyHenry operator chrome; quality bar = "a clean, trustworthy contractor document," HeyHenry barely visible ("Powered by HeyHenry" footer).
>
> **Scope.** The three **money documents** a homeowner receives — **Estimate · Change Order · Invoice/Pay** — and the shared shell that should unify them. The estimate + CO *approval* flows are specced in their own briefs; this brief owns (a) the **invoice pay surface** (unbriefed), (b) the **shared customer-document shell** all three adopt, and (c) the **consistency + payment + security** pass. The slug-keyed **project portal** (`/portal/[slug]`) is a *separate* aggregate surface — noted here, not fully specced (its own brief later).
>
> **Current vs target:** today these are **three independently-styled pages in two design languages.** Estimate + CO use design tokens (estimate signs + shows the **logo**; CO shows a text name); the **invoice pay page is the outlier** — plain gray Tailwind, **no logo**, **id-keyed**, GST shown only as a back-computed "GST (5%)", and **Interac e-Transfer is just free text** while "Pay Now" is a Stripe-only link. There's **no shared branding shell** (only a bare `(public)/layout.tsx`). The legacy PW quote view is a 4th gray variant. **Target:** one **branded customer-document system** — shared shell (logo, business header, province-aware tax, GST/WCB footer), a **professional invoice pay surface** with **Interac at true parity with Stripe**, **code-keyed** URLs throughout, clean on mobile. **Flagged** where target differs.

**Object:** the customer-facing **money document** (Estimate / Change Order / Invoice) + the **payment** action · **Roles:** **homeowner only** (no login; link/code access) · **Primary action:** understand it → **approve** (estimate/CO) or **pay** (invoice).

## Purpose
**This is the customer's whole experience of the company.** A homeowner who receives an estimate, then a change order, then an invoice should feel they're dealing with **one professional, trustworthy contractor** — same letterhead, same clarity, same easy "what do I do here." Today they get two-or-three different-looking pages, and the one that **asks for money** looks the least finished. Fixing that is brand, trust, and faster payment in one move.

## The data truth this surface must reflect
- **Three docs, one company.** All pull tenant branding from `tenants` (`name`, `logo_storage_path`, `gst_number`, `wcb_number`, `timezone`). The logo lives in the **private `photos` bucket** and must be **signed** (admin client) — the estimate + portal do this; the **invoice + legacy quote don't** (they fall back to text). No per-tenant theme colours exist.
- **Price-only, always.** Every customer doc shows customer **prices** + the **management fee %** + tax — **never** `unit_cost_cents` / `markup_pct`. (Role Matrix portal boundary — load-bearing.)
- **Keying is inconsistent:** estimate + CO are **`approval_code`-keyed** (unguessable); the **invoice (`/view/invoice/[id]`) and legacy quote (`/view/[id]`) are raw-UUID-keyed** — and the id is even echoed (`#{id.slice(0,8)}`). All four use the RLS-bypassing admin client and gate only on `status !== 'draft'`.
- **Payment is recorded server-side**, never from the public page: the **Stripe** checkout session is **pre-created at send-time** and its URL stored in `invoices.pdf_url` (the "Pay Now" link is a plain `<a href>` to it); a webhook marks paid. **Manual** (`markInvoicePaidAction`) records cash/cheque/**Interac e-Transfer** from the operator side. **No partial payments; no holdback.**
- **GST/HST is province-aware** (`canadianTax`) on the estimate; the invoice currently back-computes a flat "GST (5%)" label.

## The shared customer-document shell *(target — the system)*
Extract one **branded document wrapper** that all three docs (and the pay surface) render inside — replacing today's three bespoke layouts:
- **Header:** the GC **logo** (signed) + business name, doc type + number, "Prepared for {customer}" + date/address, and a clear **status** chip.
- **Body:** the doc's content (estimate scope by section · CO Before→After→Δ · invoice line items) — each in the same type scale + totals treatment.
- **Totals block:** Subtotal → **Management fee ({rate}%)** → **province-aware GST/HST** (one tax component, consistent label) → **Total**, CAD, tabular-nums, de-emph cents — identical across all three.
- **Footer:** GST # + WCB #, validity/terms, "Powered by HeyHenry."
- **Action zone:** the one thing to do — **Approve** (typed-name e-sig, estimate/CO) or **Pay** (invoice). Consistent placement + affordance.
- Estimate's `estimate-render.tsx` is the only existing reusable render — **promote its approach to the shared shell**; bring CO + invoice onto it.

## The invoice pay surface *(the centerpiece — `/view/invoice/[id]`)*
Rebuild on the shared shell so the doc asking for money looks as professional as the estimate:
- **Adopt the logo + tokens + province-aware tax + GST/WCB footer** (today: none of these — gray Tailwind, text name, flat GST).
- **Line items + draw context:** for a **draw**, show *which* draw and the contract context ("Draw 3 — 40% — of $X contract"); GST inclusive/on-top per the project's `draw_gst_mode` (label it honestly).
- **The pay action — two real, equal options** *(target):*
  - **Pay by card** (Stripe) — the existing pre-created checkout link.
  - **Pay by Interac e-Transfer** — **first-class, not free text.** Show the GC's e-Transfer email/instructions as a structured block (copyable), with a clear "we'll mark it received" expectation. This honors the "Interac at parity with Stripe" decision the data model already encodes (`payment_method` includes e-transfer) — Canadians pay by e-Transfer constantly.
- **States:** **sent →** the pay actions; **paid →** a clean "Paid {date} · {method}" confirmation (calm success, receipt link if present); **void →** a neutral "no longer payable." Suppress pay actions off `sent`.
- **No login wall** (correct) — but see Security.

## Consistency pass (unify the divergences)
| | Estimate | Change Order | Invoice/Pay | Target |
|---|---|---|---|---|
| Key | code | code | **id** | **code everywhere** |
| Styling | tokens | tokens | **gray Tailwind** | **shared shell** |
| Logo | yes | text | **none** | **logo everywhere** |
| Tax label | province-aware | n/a | **flat "GST 5%"** | **province-aware everywhere** |
| GST/WCB footer | yes | **none** | yes | **everywhere** |
| Decline | **none** (feedback) | yes | n/a | **decide parity** (see CO brief) |

## Security & keying *(flag — partly build-side)*
- **Move the invoice (and retire/realign the legacy quote) to an unguessable `approval_code`**, like estimate/CO; **stop echoing the raw id** in the visible doc number (use the code or a friendly invoice #). UUIDv4 isn't brute-forceable, but a purpose-built code is the right secret for a no-login PII-bearing page.
- These pages expose full customer name/address/line items to **anyone with the URL** (admin client, status-only gate, **no rate-limit/token** on `PublicViewLogger`). Recommend a hardening pass (code-keying + basic abuse protection). *(Build-side — noted for a follow-up, not an OD concern, but the keying decision shapes the URL the design assumes.)*

## The portal (related, separate surface)
`/portal/[slug]` is the **slug-keyed project hub** the customer can open any time (Project · Budget · Schedule · Photos · Selections · Ideas · Messages) — it **aggregates** a project and **links out** to the per-doc approval/pay pages (e.g. pending COs → `/approve/[code]`). It already uses tokens + signs the logo + `TenantProvider`. **This brief doesn't redesign it** — but the shared shell + the "one company" brand bar should feel continuous with it. (Portal = the ongoing relationship surface; the three docs = the transactional moments. Portal earns its own brief.)

## Henry intelligence
On the **customer** side Henry is **invisible** — the homeowner just sees a clean doc and a clear action. Henry's work is upstream (operator-side): drafting the estimate scope, the CO "why," the invoice lines, the follow-up nudges. **Nothing here is a chat or an "AI ✨" surface.** The one customer-facing intelligence touch already built — the **read-receipt** (first view notifies the operator) — stays silent to the customer.

## Role variations
- **Homeowner:** the only role here. Sees **their** doc only — price-only, no cost/markup, no other customers/jobs, no internal notes. Approve or pay; optionally comment (estimate feedback).
- **Operator:** never sees *this* surface (they have the dashboard preview); but the **preview must be faithful** ("this is exactly what your customer sees").

## Mobile vs desktop
**Homeowners overwhelmingly open these on a phone.** Mobile is the primary target:
- Single-column branded doc; logo + totals legible without zoom; **the action (Approve / Pay) is a thumb-reachable, 44px+ primary button** that doesn't require scrolling past the whole doc to find (sticky pay/approve bar).
- Typed-name e-sig input large + obvious; Interac instructions copyable in one tap; Stripe checkout opens cleanly.
- Desktop: a centered document (max ~720px), same shell.

## Financial / Canadian
- **CAD**, tabular-nums, de-emph cents. **Province-aware GST/HST** (one consistent label, not a hardcoded 5%); tax-exempt handled. **GST # + WCB #** on every doc. **Interac e-Transfer at true parity** with Stripe in the pay UI. **No holdback.** Honest draw/GST labeling (inclusive vs on-top).

## States
- **Estimate/CO:** pending → approve (typed name) / decline-or-feedback → confirmed (static card).
- **Invoice:** sent → pay (card / e-Transfer) → **paid** (confirmation + method + receipt) | **void** (neutral). Draft/missing → "not available."
- **Expired** (estimate validity window) → a clear "this estimate has expired — contact {GC}."
- **Loading:** light skeleton on the branded shell.

## Visual identity
**The GC's document, not HeyHenry's app.** A clean, professional, trustworthy letterhead: the GC **logo** + name up top, generous type, an unambiguous totals block, a single clear action. Carry HeyHenry's *quality* (Inter, tabular money, de-emph cents, calm hairlines, three type sizes) and a restrained warmth — but **the brand on the page is the contractor's**; HeyHenry is a quiet footer. One clear accent for the action button. No operator chrome, no Henry sparkle. Print-friendly (these get saved/printed).

## Accessibility
WCAG 2.2 AA: high-contrast text; the action button is a real, labeled, focus-ringed control; typed-name e-sig labeled + required; never colour-only for status (label the paid/void/expired states); ≥44px targets; the doc is readable zoomed to 200%; Stripe/Interac actions keyboard-operable; logo has alt = business name.

## Open questions
- **Keying migration:** move invoice + legacy quote to `approval_code`? (Recommended — security + consistency. Build cost: a code column + link/email updates.)
- **Interac flow depth:** structured instructions + "operator marks received" (V1) vs an integrated EFT rail (Helcim was named in scope-lock but isn't built). Lean: structured e-Transfer instructions now; integrated EFT later.
- **Shared shell extraction:** promote `estimate-render.tsx` to a shared `<CustomerDocument>` wrapper consumed by all three — confirm appetite (touches estimate + CO public pages, a PATTERNS-worthy component).
- **Decline parity** (carried from the CO brief): estimate = feedback-only, CO = decline — settle the customer's "no/not yet" affordance consistently.
- **Legacy PW quote view** (`/view/[id]`): retire for GC, or leave for the PW vertical? (Out of GC V1 scope either way.)
- **Public-page hardening** (build-side): rate-limit + token on the no-login PII pages — track separately from this OD.
