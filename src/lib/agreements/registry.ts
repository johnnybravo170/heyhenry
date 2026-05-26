/**
 * Agreement registry — the source of truth for every signable agreement.
 *
 * Each entry is keyed by `agreement_type` (the value stored in
 * `agreement_acceptances.agreement_type`) and carries its current `version`
 * plus the body the e-sign step renders (markdown, shown via RichTextDisplay
 * per PATTERNS.md §24).
 *
 * Generic by design: 'founding_member' is the only type wired today. When the
 * SaaS lawyer delivers the base ToS / Privacy / DPA, add them here as new
 * entries (e.g. 'tos') — the table, server actions, and e-sign component all
 * work unchanged. Bumping `version` re-prompts existing signers.
 *
 * Version convention: date string (matches tenant_members.tos_version).
 */

export type AgreementType = 'founding_member';

export type AgreementDef = {
  type: AgreementType;
  version: string;
  /** Short title shown as the page heading. */
  title: string;
  /** One-line framing under the title. */
  intro: string;
  /** Body, in the narrow markdown surface RichTextDisplay supports. */
  bodyMarkdown: string;
};

// NOTE (for Jonathan): this founding-member agreement is interim, plain-
// language, and NOT a lawyer-reviewed document. It bridges until the Canadian
// SaaS lawyer delivers the base ToS / Privacy Policy / DPA (tracked as the
// "Legal engagement" priority, gated before customer #2). Review the copy
// before any founder signs. Bump the version string on any change.
const FOUNDING_MEMBER: AgreementDef = {
  type: 'founding_member',
  version: '2026-05-26',
  title: 'HeyHenry Founding Member Agreement',
  intro:
    'A short, plain-language agreement covering your founding rate and what it means to build HeyHenry alongside us during the beta.',
  bodyMarkdown: `### Who this is between

This is an agreement between you (the business signing below) and HeyHenry. You are joining as a **founding member**: one of a small group of contractors helping shape the product while it is in active development.

### Your founding rate

Your subscription is **$199 CAD per month** on the Growth plan. This is the founding member rate, locked for as long as you stay subscribed as a founding member, even after the regular price (currently $399 CAD per month) goes up. If you cancel and later come back, the founding rate may no longer be available.

### This is beta software

HeyHenry is being built and improved every week. That means:

- Features will change, get added, and occasionally get reworked.
- There is no uptime guarantee or formal service level during the beta.
- You may hit the occasional rough edge or bug. When you do, we fix it fast.

You are getting in early, at a locked rate, in exchange for a bit of patience while the product matures.

### What we ask of you

Being a founding member is a two-way street. We ask that you:

- Tell us what is working and what is not. Your feedback directly shapes what we build.
- Report bugs when you find them, so we can fix them quickly.
- Be open to providing a testimonial or acting as a reference once the product has earned it. This is an expectation, not an obligation, and only when you are genuinely happy.

### Your data is yours

The information you put into HeyHenry (your customers, projects, quotes, invoices, photos) belongs to you. We handle it carefully and use it to run the product for you. A full Privacy Policy and Terms of Service are being prepared with legal counsel and will apply once published. We will let you know when they are ready.

### Billing and cancellation

Your subscription is billed monthly through Stripe and renews automatically. You can cancel anytime from your billing settings. Our written terms treat subscriptions as non-refundable, but in practice we honour refund requests without a fight. If you need to cancel or want a refund, just ask.

### Keeping pre-release work private

As a founding member you will sometimes see features before they are public. Please keep unreleased features and internal details between us until they ship, unless we have said otherwise.

### Signing

Typing your full name below is your electronic signature, the same as signing on paper. We record the date, time, and version of this agreement for both of our records.`,
};

const REGISTRY: Record<AgreementType, AgreementDef> = {
  founding_member: FOUNDING_MEMBER,
};

export function getAgreement(type: AgreementType): AgreementDef {
  return REGISTRY[type];
}
