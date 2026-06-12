/**
 * Process an inbound email row by routing it into the universal intake
 * pipeline (V2 FLIP). The narrow V1 classifier+stage path is gone —
 * `intake_drafts` is the unit of work; `inbound_emails` is now just the
 * envelope row (sender / subject / headers) linked to the draft via
 * `intake_draft_id`.
 *
 * Sequence:
 *   1. Build the InboundEmailIntakePayload from the envelope row.
 *   2. createIntakeDraftFromEmailAction → uploads attachments to the
 *      intake-audio bucket + inserts the intake_drafts row + links
 *      inbound_emails.intake_draft_id.
 *   3. Three tasks run in parallel after the draft exists:
 *        a. parseIntakeDraftAction — universal AI classifier (kind + label).
 *        b. Project-name matching — lightweight DB text search against
 *           the email subject + body to find a matching open project.
 *        c. PDF bill OCR — for each PDF attachment, run receipt_ocr to
 *           extract amount, vendor, date and store on the artifact.
 *   4. Stamp inbound_emails.status='routed_to_intake'.
 *
 * Failure modes set inbound_emails.status='bounced' or the draft's own
 * status='failed'; the inbox surface shows the failed draft in the
 * 'error' disposition.
 */

import { gateway } from '@/lib/ai-gateway';
import { createAdminClient } from '@/lib/supabase/admin';
import { createIntakeDraftFromEmailAction } from '@/server/actions/inbound-email-intake';
import type { BillExtract, IntakeArtifact } from '@/server/actions/intake';
import { parseIntakeDraftAction } from '@/server/actions/intake';

type StoredAttachment = {
  filename?: string;
  contentType?: string;
  base64?: string;
  /** The webhook persists `size` (not `contentLength`); some legacy rows
   * may use the older field name — read both. */
  size?: number;
  contentLength?: number;
};

/** Simple bill extraction schema — same three core fields as a receipt. */
const BILL_SCHEMA = {
  type: 'object',
  properties: {
    amount_cents: { type: ['integer', 'null'] },
    vendor: { type: ['string', 'null'] },
    date: { type: ['string', 'null'] },
  },
  required: ['amount_cents', 'vendor', 'date'],
} as const;

const OCR_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

/**
 * Run receipt OCR on a single attachment (PDF or image) and return the
 * extracted fields. Returns null if the gateway call fails — best-effort;
 * we don't want a failed OCR to break the entire email ingestion.
 */
async function extractBillFromAttachment(
  base64: string,
  mime: string,
  tenantId: string,
): Promise<BillExtract | null> {
  try {
    const res = await gateway().runStructured<{
      amount_cents: number | null;
      vendor: string | null;
      date: string | null;
    }>({
      kind: 'structured',
      task: 'receipt_ocr',
      tenant_id: tenantId,
      prompt: `Extract these fields from this vendor invoice, bill, or receipt. Return null for any field you cannot read with confidence. Return ONLY valid JSON — no prose, no markdown fences.

{
  "amount_cents": integer cents — total amount due or total amount charged. e.g. $1,840.00 → 184000.
  "vendor": string — name of the vendor or company that issued this invoice. null if not visible.
  "date": string — invoice date in YYYY-MM-DD format. null if not visible.
}`,
      schema: BILL_SCHEMA,
      file: { mime, base64 },
      temperature: 0.1,
    });
    const raw = res.data;
    return {
      amountCents: typeof raw.amount_cents === 'number' ? Math.round(raw.amount_cents) : null,
      vendor: typeof raw.vendor === 'string' && raw.vendor.trim() ? raw.vendor.trim() : null,
      date: typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null,
    };
  } catch {
    return null;
  }
}

/**
 * Search the tenant's active projects for a name that appears in the
 * email subject or body. Returns the first match found (exact substring,
 * case-insensitive, name >= 3 chars to avoid false positives on very
 * short names). Returns null when no match or no projects exist.
 */
async function matchProjectFromEmailText(
  tenantId: string,
  subject: string | null,
  bodyText: string | null,
): Promise<string | null> {
  const text = [subject, bodyText].filter(Boolean).join(' ');
  if (!text) return null;

  const admin = createAdminClient();
  const { data: projects } = await admin
    .from('projects')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .in('lifecycle_stage', ['planning', 'awaiting_approval', 'active'])
    .order('name');

  if (!projects?.length) return null;

  const textLower = text.toLowerCase();
  for (const project of projects) {
    const nameLower = (project.name as string).toLowerCase();
    if (nameLower.length >= 3 && textLower.includes(nameLower)) {
      return project.id as string;
    }
  }
  return null;
}

export async function processInboundEmail(emailId: string): Promise<{ draftId: string | null }> {
  const admin = createAdminClient();

  const { data: email, error: loadErr } = await admin
    .from('inbound_emails')
    .select(
      'id, tenant_id, from_address, from_name, subject, body_text, body_html, attachments, intake_draft_id, status',
    )
    .eq('id', emailId)
    .single();

  if (loadErr || !email) throw new Error(`Inbound email not found: ${emailId}`);
  if (!email.tenant_id) {
    await admin
      .from('inbound_emails')
      .update({ status: 'bounced', processed_at: new Date().toISOString() })
      .eq('id', emailId);
    return { draftId: null };
  }

  // Idempotency: if we already have a draft, just re-parse it. This is
  // how reclassify works (parseIntakeDraftAction takes a draftId), but
  // also catches a duplicate webhook delivery.
  let draftId = (email.intake_draft_id as string | null) ?? null;

  const storedAttachments = ((email.attachments as StoredAttachment[] | null) ?? [])
    .filter((a) => a.base64)
    .slice(0, 12);

  if (!draftId) {
    const postmarkAttachments = storedAttachments.map((a) => ({
      Name: a.filename ?? 'attachment',
      ContentType: a.contentType ?? 'application/octet-stream',
      Content: a.base64 ?? '',
      ContentLength: a.contentLength ?? a.size ?? 0,
    }));

    const draftRes = await createIntakeDraftFromEmailAction({
      emailId: emailId,
      tenantId: email.tenant_id as string,
      fromAddress: email.from_address as string,
      fromName: (email.from_name as string | null) ?? null,
      subject: (email.subject as string | null) ?? null,
      bodyText: (email.body_text as string | null) ?? null,
      bodyHtml: (email.body_html as string | null) ?? null,
      attachments: postmarkAttachments,
    });

    if (!draftRes.ok) {
      await admin
        .from('inbound_emails')
        .update({
          status: 'bounced',
          error_message: `Intake draft create failed: ${draftRes.error}`.slice(0, 500),
          processed_at: new Date().toISOString(),
        })
        .eq('id', emailId);
      return { draftId: null };
    }
    draftId = draftRes.draftId;
  }

  // Mark routed (envelope-level state). Done before the parse so the inbox
  // shows the row immediately even if parsing is slow.
  await admin
    .from('inbound_emails')
    .update({ status: 'routed_to_intake', processed_at: new Date().toISOString() })
    .eq('id', emailId);

  // Identify attachments eligible for bill OCR (PDFs + common image formats).
  const ocrAttachments = storedAttachments.filter(
    (a) => a.base64 && a.contentType && OCR_MIME_TYPES.has(a.contentType),
  );

  // Run the universal classifier, project matching, and PDF OCR all in
  // parallel. Failures are isolated: parse failure → draft status='failed'
  // (operator can reclassify); project/OCR failures → silently skipped.
  const [, projectMatchResult, ...ocrResults] = await Promise.allSettled([
    parseIntakeDraftAction(draftId).catch((err) => {
      console.error('[processor] parseIntakeDraftAction failed', { draftId, error: err });
    }),
    matchProjectFromEmailText(
      email.tenant_id as string,
      email.subject as string | null,
      email.body_text as string | null,
    ),
    ...ocrAttachments.map((a) =>
      extractBillFromAttachment(
        a.base64 as string,
        a.contentType as string,
        email.tenant_id as string,
      ),
    ),
  ]);

  // Collect results.
  const recognizedProjectId =
    projectMatchResult.status === 'fulfilled' ? (projectMatchResult.value ?? null) : null;

  const billExtracts: Array<{ filename: string; extract: BillExtract | null }> = ocrAttachments
    .map((a, i) => ({
      filename: a.filename ?? 'attachment',
      extract: ocrResults[i]?.status === 'fulfilled' ? (ocrResults[i]?.value ?? null) : null,
    }))
    .filter((b) => b.extract !== null);

  // Persist recognized_project_id and bill_extract fields on the draft.
  // bill_extract is merged into the artifact rows that match by filename.
  if (recognizedProjectId || billExtracts.length > 0) {
    const { data: draftRow } = await admin
      .from('intake_drafts')
      .select('artifacts')
      .eq('id', draftId)
      .single();

    const currentArtifacts = (draftRow?.artifacts as IntakeArtifact[] | null) ?? [];
    const updatedArtifacts: IntakeArtifact[] =
      billExtracts.length > 0
        ? currentArtifacts.map((a) => {
            const match = billExtracts.find(
              (b) => b.filename === a.name || a.path.endsWith(`/${b.filename}`),
            );
            return match ? { ...a, bill_extract: match.extract } : a;
          })
        : currentArtifacts;

    const patch: Record<string, unknown> = {};
    if (recognizedProjectId) patch.recognized_project_id = recognizedProjectId;
    if (billExtracts.length > 0) patch.artifacts = updatedArtifacts;

    if (Object.keys(patch).length > 0) {
      await admin.from('intake_drafts').update(patch).eq('id', draftId);
    }
  }

  return { draftId };
}
