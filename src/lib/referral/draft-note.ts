/**
 * Henry's "draft a note" for a referral invite — a short, warm, peer-to-peer
 * message in the operator's voice. Deterministic (no LLM round-trip): this is
 * a low-stakes growth touch that must always work instantly and offline, and
 * the operator edits + sends every word — nothing is auto-sent.
 *
 * `Try another draft` cycles `variant` through the templates below. The note
 * is plain text; the send actions thread it into the email/SMS body.
 */

type DraftArgs = {
  /** The operator's business / display name (the "from" voice). */
  referrerName: string;
  /** The full referral link (app.heyhenry.io/r/{code}). */
  referralUrl: string;
};

const TEMPLATES: ((a: DraftArgs) => string)[] = [
  ({ referralUrl }) =>
    `Hey,

You should check out HeyHenry — it's the tool I switched to for running quotes, invoices, and the client side of things. Way less time fighting spreadsheets. Figured you'd get something out of it too.

Here's my link if you want a 14-day extended trial: ${referralUrl}`,
  ({ referralUrl }) =>
    `Quick one — I've been using HeyHenry to run my contracting business and it's saved me a ton of admin time. Quotes, scheduling, invoicing, all in one place.

If you want to try it, here's my link (gets you an extra-long trial): ${referralUrl}`,
  ({ referralUrl }) =>
    `Thought of you — HeyHenry has been a solid fit for how I run jobs day to day. Easy to send quotes and get paid without the back-and-forth.

Here's my link for a free 14-day trial: ${referralUrl}`,
];

export const DRAFT_NOTE_VARIANTS = TEMPLATES.length;

/** Build a draft note. `variant` is taken modulo the template count. */
export function draftReferralNote(args: DraftArgs, variant = 0): string {
  const template = TEMPLATES[((variant % TEMPLATES.length) + TEMPLATES.length) % TEMPLATES.length];
  // biome-ignore lint/style/noNonNullAssertion: index is bounded by the modulo above.
  return template!(args);
}
