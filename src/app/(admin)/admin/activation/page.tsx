import { ActivationTable } from '@/components/features/admin/activation-table';
import { getFoundingMemberActivation } from '@/lib/db/queries/founding-member-activation';

export const dynamic = 'force-dynamic';

export default async function AdminActivationPage() {
  const members = await getFoundingMemberActivation();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Founding-member activation</h1>
        <p className="text-sm text-muted-foreground">
          Where each founding member sits on the sacred path, and where they&apos;ve stalled. Pull
          this up right before a concierge-onboarding call. Stalest first.
        </p>
      </div>
      <ActivationTable members={members} />
    </div>
  );
}
