/**
 * Henry morning briefing — data shape.
 *
 * Shared by:
 *   - the `get_morning_briefing` Henry tool (on-demand)
 *   - the nightly cron at /api/cron/henry-nightly (scheduled wire)
 *
 * No nightly delivery channel exists yet — the data shape is all the
 * cron writes today. When SMS / push lands, that channel reads from
 * here. Flagged as a follow-up.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type BriefingTask = {
  id: string;
  title: string;
  due_date: string | null;
  days_overdue?: number;
  days_waiting?: number;
};

export type BriefingSuggestion = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
};

export type MorningBriefing = {
  tenant_id: string;
  generated_at: string;
  due_tomorrow: { count: number; top: BriefingTask[] };
  overdue_today: { count: number; top: BriefingTask[] };
  blocked: { count: number; top: BriefingTask[] };
  to_verify_count: number;
  suggestions: BriefingSuggestion[];
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function daysBetween(a: string, b: string): number {
  return Math.max(
    0,
    Math.floor((new Date(a).getTime() - new Date(b).getTime()) / (24 * 60 * 60 * 1000)),
  );
}

const BLOCKED_STATUSES = ['blocked', 'waiting_client', 'waiting_material', 'waiting_sub'];

/**
 * Build the briefing for a single tenant. Uses the admin client so it
 * works from a cron context (no auth.uid()) and from a chat-tool context
 * where we already have the tenant id from getCurrentTenant().
 */
export async function buildMorningBriefing(tenantId: string): Promise<MorningBriefing> {
  const admin = createAdminClient();
  const today = isoDate(new Date());
  const tomorrow = isoDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const { data: openTasks } = await admin
    .from('tasks')
    .select('id, title, status, due_date, updated_at')
    .eq('tenant_id', tenantId)
    .not('status', 'in', '(done,verified)');

  const rows = openTasks ?? [];

  const dueTomorrow: BriefingTask[] = [];
  const overdueToday: BriefingTask[] = [];
  const blocked: BriefingTask[] = [];

  for (const t of rows) {
    const due = t.due_date as string | null;
    if (due === tomorrow) {
      dueTomorrow.push({ id: t.id as string, title: t.title as string, due_date: due });
    }
    if (due && due < today) {
      overdueToday.push({
        id: t.id as string,
        title: t.title as string,
        due_date: due,
        days_overdue: daysBetween(today, due),
      });
    }
    if (BLOCKED_STATUSES.includes(t.status as string)) {
      blocked.push({
        id: t.id as string,
        title: t.title as string,
        due_date: due,
        days_waiting: daysBetween(today, isoDate(new Date(t.updated_at as string))),
      });
    }
  }

  overdueToday.sort((a, b) => (b.days_overdue ?? 0) - (a.days_overdue ?? 0));
  blocked.sort((a, b) => (b.days_waiting ?? 0) - (a.days_waiting ?? 0));

  // To Verify count: done rows without verified_at.
  const { count: toVerifyCount } = await admin
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'done')
    .is('verified_at', null);

  // Open Henry suggestions in the last 24h.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: suggestions } = await admin
    .from('notifications')
    .select('id, title, body, created_at')
    .eq('tenant_id', tenantId)
    .eq('kind', 'henry_suggestion')
    .is('read_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  return {
    tenant_id: tenantId,
    generated_at: new Date().toISOString(),
    due_tomorrow: { count: dueTomorrow.length, top: dueTomorrow.slice(0, 3) },
    overdue_today: { count: overdueToday.length, top: overdueToday.slice(0, 3) },
    blocked: { count: blocked.length, top: blocked.slice(0, 3) },
    to_verify_count: toVerifyCount ?? 0,
    suggestions: ((suggestions ?? []) as BriefingSuggestion[]).map((s) => ({
      id: s.id,
      title: s.title,
      body: s.body,
      created_at: s.created_at,
    })),
  };
}

/** Render a briefing as plain text for the chat tool / cron output. */
export function renderBriefing(b: MorningBriefing): string {
  const lines: string[] = [];
  lines.push(`Morning Briefing (${b.generated_at.slice(0, 10)})`);
  lines.push('='.repeat(40));

  lines.push(`\nDue tomorrow: ${b.due_tomorrow.count}`);
  for (const t of b.due_tomorrow.top) lines.push(`  - ${t.title}`);

  lines.push(`\nOverdue today: ${b.overdue_today.count}`);
  for (const t of b.overdue_today.top) lines.push(`  - ${t.title} (${t.days_overdue}d overdue)`);

  lines.push(`\nBlocked: ${b.blocked.count}`);
  for (const t of b.blocked.top) lines.push(`  - ${t.title} (${t.days_waiting}d waiting)`);

  lines.push(`\nTo Verify: ${b.to_verify_count}`);

  lines.push(`\nHenry suggestions (last 24h): ${b.suggestions.length}`);
  for (const s of b.suggestions) lines.push(`  - ${s.title}: ${s.body ?? ''}`);

  return lines.join('\n');
}
