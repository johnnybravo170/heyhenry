import { CalendarFeedCard } from '@/components/features/settings/calendar-feed-card';
import { SettingsPageHeader } from '@/components/features/settings/settings-page-header';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Calendar — Settings' };

export default async function CalendarSettingsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;

  // The feed is gated on a high-entropy secret token (not the guessable slug),
  // so it isn't carried on the shared CurrentTenant object. Read it under RLS.
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('tenants')
    .select('calendar_feed_token')
    .eq('id', tenant.id)
    .maybeSingle();

  const feedToken = row?.calendar_feed_token as string | null | undefined;
  if (!feedToken) return null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.heyhenry.io';
  const feedUrl = `${baseUrl}/api/calendar/${feedToken}.ics`;

  return (
    <>
      <SettingsPageHeader
        title="Calendar feed"
        description="Subscribe to your scheduled jobs in Google Calendar, Apple Calendar, or any iCal-aware app."
      />
      <CalendarFeedCard feedUrl={feedUrl} />
    </>
  );
}
