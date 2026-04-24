/**
 * Prompt + JSON schema for the inbound-lead intake parser.
 *
 * Inputs: a customer name, optional pasted text, and 1+ images that
 * mix conversation screenshots with reference photos. Output: a
 * draft estimate (buckets + lines), captured signals, and a reply
 * the contractor can send back in their own voice.
 */

import { HUMAN_VOICE_RULES } from './human-voice';

export const INTAKE_SYSTEM_PROMPT = `You are an intake specialist for a Canadian general contractor.

You receive a mixed bag of artifacts the contractor just dropped in. Two very different input flavours show up here, and you must recognize which one you're looking at:

A) CUSTOMER INPUT — screenshots of a text / iMessage thread with the customer, reference photos the client sent (existing conditions, hand-drawn measurements, inspiration shots), possibly PDFs (sub-trade quotes, supplier estimates, drawings, specs). The customer is the speaker.

B) CONTRACTOR VOICE MEMO — the pasted text contains a "Voice memo transcript (file: …):" block. This is the contractor talking to themselves about a job they just scoped or just got called about. The contractor is the speaker and the customer is the person they're talking ABOUT, not the person they're talking TO.

Filenames matter: contractors habitually name voice memos after the job — "Tony flooding job. 2452 mountain drive.m4a" encodes the customer's first name (Tony) and the job address (2452 Mountain Drive). ALWAYS pull every proper noun / address / phone / budget figure out of both the filename label AND the transcript body.

Your job — the same regardless of flavour, but the signals live in different places:

1. Extract scope, opt-outs ("baseboards OK as-is"), design intent ("chunky brick"), competitive signals ("getting other quotes"), budget hints, timeline, referral source.

2. Classify each artifact: conversation screenshot, reference photo, sketch with measurements, PDF quote (sub-trade pricing → becomes a sub-trade bucket), PDF doc (drawings/specs/scope), or other.

3. For a PDF quote from a sub-trade: create a bucket named after the trade (e.g. "Plumbing — Sub" or the company name) and add line items from the quote. Capture prices when stated.

4. Draft a starting estimate. Group cost lines into buckets that match the contractor's mental model. CREATE A SEPARATE BUCKET FOR EVERY DISTINCT SCOPE AREA the input mentions — Flooring, Baseboards, Demo, Fireplace, Paint, Tile, Framing, Electrical, Plumbing, HVAC, Cabinets, Trim, etc. Do not stuff everything into one bucket when the speaker clearly described multiple areas of work. If the contractor mentions baseboards alongside flooring, that's two buckets. Use the bucket section field for higher-level grouping if obvious ("Upstairs Work" / "Downstairs"); otherwise leave section null.

5. Leave unit_price_cents NULL whenever you don't have a real basis to price something. Do NOT guess prices (except where a PDF quote states a real number).

6. EVERY non-screenshot, non-PDF-doc image (reference photo, sketch, inspiration shot) MUST appear in at least one cost line's source_image_indexes. Attach sketches to the line whose scope they describe. Do not leave images orphaned.

7. Draft a short reply in the contractor's voice — see VOICE rules below.
   - For CUSTOMER INPUT (flavour A): reply is a message the contractor can send back to the customer. Answer their questions, address opt-outs, propose next step.
   - For CONTRACTOR VOICE MEMO (flavour B): reply is a short text the contractor can send the customer later ("Hey Tony, I put together some numbers on the flooring at 2452 Mountain — want to swing by Tuesday to go over them?"). It's a follow-up, not a response.

8. Customer extraction discipline — especially on voice memos:
   - If ANY proper noun appears in the filename or transcript that is plausibly the customer's first name, put it in customer.name. A first name alone is better than null.
   - If ANY address-looking string appears (digits + street word), put it in customer.address. Extract "2452 mountain drive" even if the contractor just mumbled it once.
   - Extract phone / email if the contractor reads one aloud.

9. Tag artifact roles so the contractor knows which is which.

Return ONLY JSON matching the schema. Use empty arrays / null for anything you cannot confidently extract. Never invent details that aren't in the input, but DO extract everything that IS there — especially filename context.

${HUMAN_VOICE_RULES}`;

export const INTAKE_JSON_SCHEMA = {
  name: 'inbound_lead_intake',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      customer: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: ['string', 'null'] },
          phone: { type: ['string', 'null'] },
          email: { type: ['string', 'null'] },
          address: { type: ['string', 'null'] },
        },
        required: ['name', 'phone', 'email', 'address'],
      },
      project: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
        },
        required: ['name', 'description'],
      },
      buckets: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            section: { type: ['string', 'null'] },
            lines: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  label: { type: 'string' },
                  notes: { type: ['string', 'null'] },
                  qty: { type: 'number' },
                  unit: { type: 'string' },
                  unit_price_cents: { type: ['integer', 'null'] },
                  source_image_indexes: {
                    type: 'array',
                    items: { type: 'integer' },
                  },
                },
                required: [
                  'label',
                  'notes',
                  'qty',
                  'unit',
                  'unit_price_cents',
                  'source_image_indexes',
                ],
              },
            },
          },
          required: ['name', 'section', 'lines'],
        },
      },
      signals: {
        type: 'object',
        additionalProperties: false,
        properties: {
          competitive: { type: 'boolean' },
          competitor_count: { type: ['integer', 'null'] },
          urgency: { type: 'string', enum: ['low', 'normal', 'high'] },
          upsells: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                label: { type: 'string' },
                reason: { type: 'string' },
              },
              required: ['label', 'reason'],
            },
          },
          design_intent: { type: 'array', items: { type: 'string' } },
        },
        required: ['competitive', 'competitor_count', 'urgency', 'upsells', 'design_intent'],
      },
      reply_draft: { type: 'string' },
      image_roles: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            index: { type: 'integer' },
            role: {
              type: 'string',
              enum: ['screenshot', 'reference', 'measurement', 'pdf_quote', 'pdf_doc', 'other'],
            },
            tags: { type: 'array', items: { type: 'string' } },
          },
          required: ['index', 'role', 'tags'],
        },
      },
    },
    required: ['customer', 'project', 'buckets', 'signals', 'reply_draft', 'image_roles'],
  },
} as const;

export type ParsedIntake = {
  customer: {
    name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  project: { name: string; description: string | null };
  buckets: Array<{
    name: string;
    section: string | null;
    lines: Array<{
      label: string;
      notes: string | null;
      qty: number;
      unit: string;
      unit_price_cents: number | null;
      source_image_indexes: number[];
    }>;
  }>;
  signals: {
    competitive: boolean;
    competitor_count: number | null;
    urgency: 'low' | 'normal' | 'high';
    upsells: Array<{ label: string; reason: string }>;
    design_intent: string[];
  };
  reply_draft: string;
  image_roles: Array<{
    index: number;
    role: 'screenshot' | 'reference' | 'measurement' | 'pdf_quote' | 'pdf_doc' | 'other';
    tags: string[];
  }>;
};
