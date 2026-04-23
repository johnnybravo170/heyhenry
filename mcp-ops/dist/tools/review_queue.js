import { describeError, opsRequest } from '../client.js';
import { errorResult, formatDateTime, textResult } from '../types.js';
export function registerReviewQueueTools(server) {
    server.tool('review_queue_fetch', 'Single round trip that returns the four stacks Jonathan reviews each day: social drafts awaiting approval, open/triaging incidents, competitor cards not checked in 7+ days, and docs created in the last 7 days. Use this as the "what needs me?" prompt at the start of a triage routine.', {}, async () => {
        try {
            const q = await opsRequest('GET', `/api/ops/review-queue`);
            let out = '';
            out += `=== Social drafts awaiting approval (${q.social_drafts.length}) ===\n`;
            for (const d of q.social_drafts) {
                out += `- [${d.channel}] ${d.topic} (${formatDateTime(d.created_at)}, id: ${d.id})\n`;
            }
            out += `\n=== Open incidents (${q.incidents_open.length}) ===\n`;
            for (const i of q.incidents_open) {
                out += `- [${i.severity}] [${i.status}] ${i.title}`;
                if (i.sms_escalated_at)
                    out += ' (SMS-paged)';
                out += ` (id: ${i.id})\n`;
            }
            out += `\n=== Stale competitors — not checked in 7+ days (${q.competitors_stale.length}) ===\n`;
            for (const c of q.competitors_stale) {
                out += `- ${c.name} (last_checked: ${c.last_checked_at ? formatDateTime(c.last_checked_at) : 'never'}, id: ${c.id})\n`;
            }
            out += `\n=== Recent docs — last 7 days (${q.docs_recent.length}) ===\n`;
            for (const d of q.docs_recent) {
                out += `- [${d.module}] ${d.commit_range} (${formatDateTime(d.created_at)} by ${d.actor_name ?? 'unknown'}, id: ${d.id})\n`;
            }
            return textResult(out);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
}
//# sourceMappingURL=review_queue.js.map