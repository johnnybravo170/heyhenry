'use client';

import { Mail, MessageSquare } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendReferralEmailAction } from '@/server/actions/referrals';

export function SendReferralForm() {
  const [email, setEmail] = useState('');
  const [pendingEmail, startEmailTransition] = useTransition();

  function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    startEmailTransition(async () => {
      const result = await sendReferralEmailAction(email.trim());
      if (result.ok) {
        toast.success('Referral invite sent!');
        setEmail('');
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Send an invite</CardTitle>
        <CardDescription>Invite a fellow contractor by email or SMS.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSendEmail} className="space-y-2">
          <Label htmlFor="referral-email">Email</Label>
          <div className="flex gap-2">
            <Input
              id="referral-email"
              type="email"
              placeholder="contractor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pendingEmail}
            />
            <Button type="submit" disabled={pendingEmail || !email.trim()}>
              <Mail className="mr-2 h-4 w-4" />
              {pendingEmail ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            SMS
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              Coming soon
            </span>
          </Label>
          <div className="flex gap-2">
            <Input type="tel" placeholder="+16045551234" disabled />
            <Button disabled>
              <MessageSquare className="mr-2 h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
