import { findWorkerInviteByCode } from '@/lib/db/queries/worker-invites';

/**
 * GET /api/invite/:code
 *
 * Public endpoint for the join page to validate an invite code and
 * display the tenant name before the user fills in the signup form.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const invite = await findWorkerInviteByCode(code);
  if (!invite) {
    return Response.json({ valid: false }, { status: 404 });
  }

  return Response.json({
    valid: true,
    tenantName: invite.tenant_name,
  });
}
