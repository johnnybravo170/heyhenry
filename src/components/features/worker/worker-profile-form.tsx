'use client';

import { Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { WorkerProfileRow } from '@/lib/db/queries/worker-profiles';
import { updateOwnWorkerProfileAction } from '@/server/actions/worker-profiles';

type Props = { profile: WorkerProfileRow };

export function WorkerProfileForm({ profile }: Props) {
  const [pending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [businessName, setBusinessName] = useState(profile.business_name ?? '');
  const [gstNumber, setGstNumber] = useState(profile.gst_number ?? '');
  const [address, setAddress] = useState(profile.address ?? '');
  const [nudgeEmail, setNudgeEmail] = useState(profile.nudge_email);
  const [nudgeSms, setNudgeSms] = useState(profile.nudge_sms);

  const isSub = profile.worker_type === 'subcontractor';

  function handleSave() {
    startTransition(async () => {
      const result = await updateOwnWorkerProfileAction({
        display_name: displayName,
        phone,
        business_name: businessName,
        gst_number: gstNumber,
        address,
        nudge_email: nudgeEmail,
        nudge_sms: nudgeSms,
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to save.');
        return;
      }
      toast.success('Profile saved.');
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">About you</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="display_name">Name</Label>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Dan Smith"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(250) 555-0142"
            />
          </div>
        </CardContent>
      </Card>

      {isSub ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="business_name">Business name</Label>
              <Input
                id="business_name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Smith Framing Ltd."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gst_number">GST number</Label>
              <Input
                id="gst_number"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                placeholder="123456789 RT0001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              id="nudge_email"
              checked={nudgeEmail}
              onCheckedChange={(v) => setNudgeEmail(v === true)}
            />
            <Label htmlFor="nudge_email" className="font-normal">
              Email me if I forget to log time
            </Label>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              id="nudge_sms"
              checked={nudgeSms}
              onCheckedChange={(v) => setNudgeSms(v === true)}
            />
            <Label htmlFor="nudge_sms" className="font-normal">
              Text me if I forget to log time
            </Label>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={pending} className="w-full">
        {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Save
      </Button>
    </div>
  );
}
