import { requireWorker } from '@/lib/auth/helpers';
import { previewUnbilledForWorker } from '@/lib/db/queries/worker-invoices';
import { getOrCreateWorkerProfile } from '@/lib/db/queries/worker-profiles';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const { tenant } = await requireWorker();
  const profile = await getOrCreateWorkerProfile(tenant.id, tenant.member.id);

  const url = new URL(request.url);
  const projectId = url.searchParams.get('project_id');
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from) {
    return Response.json({ time: [], expenses: [] });
  }

  const data = await previewUnbilledForWorker({
    tenantId: tenant.id,
    workerProfileId: profile.id,
    projectId: projectId || null,
    fromDate: from,
    toDate: to,
  });
  return Response.json(data);
}
