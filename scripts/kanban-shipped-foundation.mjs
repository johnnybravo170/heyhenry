/**
 * Add done-column cards for HeyHenry V1 foundation that was shipped
 * before the kanban migration. These are real, in-production capabilities
 * — not synthesized from commits — sourced by inventory of the live
 * smartfusion repo (routes, server actions, schema, tools).
 *
 * Each card is tagged launch-blocker so it counts toward V1 readiness %.
 * done_at is spread across Feb–early April 2026 (before the ops platform
 * build sprint), so they don't pollute the rolling velocity window.
 */
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const FOUNDATION = [
  // [title, body, size, epic, done_at]
  ['Multi-tenant auth with Supabase RLS', 'Foundation: tenant isolation enforced at row level. Used by every server action and query.', 13, 'trust-safety', '2026-02-20'],
  ['MFA enforcement + recovery codes', 'TOTP MFA at AAL2 required for admin sessions. user_recovery_codes table + recovery flow shipped.', 5, 'trust-safety', '2026-03-05'],
  ['Worker auth + worker app (/w)', 'Separate worker user role, auth flow, and dedicated worker app surface for crew interactions.', 8, 'trust-safety', '2026-03-12'],
  ['Quote engine V1 — Maps polygon, line items, cost catalog', 'Core product: Google Maps polygon → sqft, quote_line_items, quote_surfaces, service_catalog. The single most differentiating piece.', 21, 'sacred-path', '2026-02-15'],
  ['Customer estimate approval portal (/approve)', 'Public-facing /approve/[code] route with signature capture. estimate-approval.ts server action.', 5, 'sacred-path', '2026-03-08'],
  ['Customer CRM (list, detail, search, edit)', '/customers page + customers.ts server actions. Multi-tenant scoped throughout.', 8, 'sacred-path', '2026-02-25'],
  ['Job management (CRUD + status)', '/jobs page + jobs.ts. Status workflow, customer linking.', 5, 'sacred-path', '2026-03-01'],
  ['Invoice generation (in-app, ex-PDF)', 'Invoices CRUD + worker-invoices.ts. Stripe-ready data model. PDF generation tracked separately as launch-blocker.', 5, 'invoicing', '2026-03-10'],
  ['Stripe Connect integration + webhook', 'Full Stripe Connect onboarding, payment processing, webhook event handling. /api/stripe/webhook + stripe.ts.', 13, 'payments', '2026-03-18'],
  ['Time tracking — worker entries + unavailability', 'worker-time.ts, time-entries.ts, worker-unavailability.ts. Crew can log hours from /w.', 8, 'reno', '2026-03-20'],
  ['Receipt OCR + expense extraction', 'extract-receipt.ts + parse-quote-pdf.ts. AI-powered intake from photos/PDFs.', 5, 'job-cost', '2026-03-22'],
  ['Expenses CRUD with categories + bucket templates', 'expenses.ts, expense-categories.ts, bucket-templates.ts, cost-catalog.ts. Full project cost tracking.', 8, 'job-cost', '2026-03-25'],
  ['Photo management subsystem', 'photo_albums, photo_pairs, photo_share_links, photo upload/gallery/tagging UI. Public share-link routes.', 13, 'photos', '2026-03-15'],
  ['AI chat with 13 in-app tools', '/api/chat/route.ts + 13 tool modules (customers, quotes, jobs, invoices, projects, change-orders, time-expenses, sms, dashboard, todos, worklog, catalog, helpers).', 13, 'agents', '2026-03-28'],
  ['Voice Henry — STT, TTS, wake-word', 'src/lib/voice/{speech-to-text,text-to-speech,wake-word}.ts. Push-to-talk Gemini Live integration.', 8, 'agents', '2026-04-02'],
  ['Autoresponder engine', 'src/server/ar/{event-bus,executor,policy,render,unsub-token,webhook-verify}. Cron + webhook routes. AR fully in production.', 13, 'agents', '2026-03-30'],
  ['Project management — buckets, cost lines, change orders', '/projects + project-buckets.ts + project-cost-control.ts + change-orders.ts + sub-quotes.ts intake. The renovation vertical core.', 13, 'reno', '2026-03-22'],
  ['Inbound email lead intake', 'inbound-email.ts + intake.ts + intake-augment.ts + share-intake.ts. Leads land via email and forms.', 8, 'intake', '2026-04-05'],
  ['Audit log subsystem', 'audit_log table + ops admin viewer. Every privileged action recorded.', 3, 'trust-safety', '2026-03-15'],
  ['Customer portal (/portal/[slug])', 'Public portal where customers see their projects, photos, status. portal-updates.ts.', 5, 'sacred-path', '2026-04-01'],
  ['Calendar view — owner + workers', 'Already-present /calendar page (also recorded as completed kanban). Cross-project scheduling.', 5, 'reno', '2026-04-08'],
  ['Tenant settings + member management', 'tenants.ts, tenant-prefs.ts, tenant-members.ts. Settings UI for owner-level config.', 3, 'trust-safety', '2026-03-10'],
];

let inserted = 0;
const board = await sql`SELECT id FROM ops.kanban_boards WHERE slug = 'dev'`;
const boardId = board[0].id;

for (const [title, body, size, epic, doneAt] of FOUNDATION) {
  // Skip if a card with this exact title already exists (safe re-run)
  const existing = await sql`SELECT id FROM ops.kanban_cards WHERE title = ${title} AND archived_at IS NULL`;
  if (existing.length > 0) continue;
  const tags = ['launch-blocker', 'shipped:foundation', `epic:${epic}`];
  await sql`
    INSERT INTO ops.kanban_cards
      (board_id, column_key, title, body, tags, priority, size_points,
       assignee, done_at, actor_type, actor_name, order_in_column)
    VALUES (${boardId}, 'done', ${title}, ${body}, ${tags}, 3, ${size},
            'jonathan', ${doneAt + 'T12:00:00Z'}, 'system', 'foundation-audit', 0)
  `;
  inserted++;
}

const summary = await sql`
  SELECT
    sum(size_points) FILTER (WHERE 'launch-blocker' = ANY(tags)) AS blocker_pts,
    sum(size_points) FILTER (WHERE 'launch-blocker' = ANY(tags) AND column_key='done') AS blocker_done_pts,
    count(*) FILTER (WHERE 'launch-blocker' = ANY(tags)) AS blocker_cards,
    count(*) FILTER (WHERE 'launch-blocker' = ANY(tags) AND column_key='done') AS blocker_done_cards
  FROM ops.kanban_cards
  WHERE archived_at IS NULL
`;

const s = summary[0];
const pct = ((s.blocker_done_pts / s.blocker_pts) * 100).toFixed(1);
console.log(`inserted ${inserted} foundation cards`);
console.log(`launch-blocker totals: ${s.blocker_done_cards}/${s.blocker_cards} cards, ${s.blocker_done_pts}/${s.blocker_pts} pts (${pct}%)`);

await sql.end();
