import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireWorker } from '@/lib/auth/helpers';
import { getOrCreateWorkerProfile } from '@/lib/db/queries/worker-profiles';

export default async function WorkerTodayPage() {
  const { tenant } = await requireWorker();
  const profile = await getOrCreateWorkerProfile(tenant.id, tenant.member.id);

  const today = new Date().toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const profileIncomplete =
    !profile.display_name ||
    !profile.phone ||
    (profile.worker_type === 'subcontractor' && !profile.gst_number);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground">{today}</p>
        <h1 className="text-2xl font-semibold">
          Hi{profile.display_name ? `, ${profile.display_name.split(' ')[0]}` : ''}.
        </h1>
      </div>

      {profileIncomplete ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Finish setting up your profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Add your name, phone number
              {profile.worker_type === 'subcontractor' ? ', and GST number' : ''} so your time and
              invoices are tagged correctly.
            </p>
            <Link
              href="/w/profile"
              className="inline-flex items-center rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background"
            >
              Open profile
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s schedule</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No projects scheduled for today. You&apos;ll see assignments here once your supervisor
          schedules them.
        </CardContent>
      </Card>
    </div>
  );
}
